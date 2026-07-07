package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ──────────────────────────────────────────────
// Data models
// ──────────────────────────────────────────────

type BuildRequest struct {
	TaskID            string `json:"taskId"`
	RegistryURL       string `json:"registryUrl"`
	RegistryAuthority string `json:"registryAuthority"`
	NamespaceName     string `json:"namespaceName"`
	Username          string `json:"username"`
	Password          string `json:"password"`
	SQLContent        string `json:"sqlContent"`
	JobName           string `json:"jobName"`
	VersionNo         int    `json:"versionNo"`
	FlinkBaseImage    string `json:"flinkBaseImage"`
	RunnerJarBase64   string `json:"runnerJarBase64"`
	InsecureRegistry  bool   `json:"insecureRegistry"`
	BuildProxy        string `json:"buildProxy"`
}

type TaskStatus struct {
	TaskID      string `json:"taskId"`
	Status      string `json:"status"` // PENDING | RUNNING | SUCCEEDED | FAILED
	ImageURI    string `json:"imageUri,omitempty"`
	ImageDigest string `json:"imageDigest,omitempty"`
	Log         string `json:"log,omitempty"`
	StartedAt   string `json:"startedAt,omitempty"`
	FinishedAt  string `json:"finishedAt,omitempty"`
}

// ──────────────────────────────────────────────
// In-memory task store
// ──────────────────────────────────────────────

var tasks sync.Map // taskId -> *TaskStatus

func storeTask(t *TaskStatus) { tasks.Store(t.TaskID, t) }

func loadTask(id string) (*TaskStatus, bool) {
	v, ok := tasks.Load(id)
	if !ok {
		return nil, false
	}
	return v.(*TaskStatus), true
}

// ──────────────────────────────────────────────
// HTTP handlers
// ──────────────────────────────────────────────

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func handleBuild(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 64*1024*1024))
	if err != nil {
		http.Error(w, "failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req BuildRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.TaskID == "" || req.RegistryAuthority == "" || req.SQLContent == "" || req.RunnerJarBase64 == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}
	task := &TaskStatus{TaskID: req.TaskID, Status: "PENDING", StartedAt: time.Now().UTC().Format(time.RFC3339)}
	storeTask(task)
	go runBuild(req, task)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(task)
}

func handleGetTask(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/tasks/"), "/")
	taskID := parts[0]
	if taskID == "" {
		http.Error(w, "missing taskId", http.StatusBadRequest)
		return
	}
	task, ok := loadTask(taskID)
	if !ok {
		http.Error(w, "task not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(task)
}

// ──────────────────────────────────────────────
// Build logic
// ──────────────────────────────────────────────

func runBuild(req BuildRequest, task *TaskStatus) {
	task.Status = "RUNNING"
	storeTask(task)

	var logBuf strings.Builder
	appendLog := func(msg string) {
		logBuf.WriteString(msg)
		logBuf.WriteString("\n")
		task.Log = truncateLog(logBuf.String(), 64*1024)
		storeTask(task)
	}

	imageRef := buildImageRef(req)
	appendLog(fmt.Sprintf("[worker] starting build task=%s image=%s", req.TaskID, imageRef))

	workDir, err := os.MkdirTemp("", "rayflow-build-")
	if err != nil {
		fail(task, &logBuf, "failed to create temp dir: "+err.Error())
		return
	}
	defer os.RemoveAll(workDir)

	// ── Decode and write runner JAR ───────────────────────────────────────
	jarBytes, err := base64.StdEncoding.DecodeString(req.RunnerJarBase64)
	if err != nil {
		fail(task, &logBuf, "failed to decode runner jar: "+err.Error())
		return
	}
	if err := os.WriteFile(filepath.Join(workDir, "rayflow-flink-sql-runner.jar"), jarBytes, 0644); err != nil {
		fail(task, &logBuf, "failed to write runner jar: "+err.Error())
		return
	}

	// ── Write job.sql ─────────────────────────────────────────────────────
	if err := os.WriteFile(filepath.Join(workDir, "job.sql"), []byte(req.SQLContent), 0644); err != nil {
		fail(task, &logBuf, "failed to write job.sql: "+err.Error())
		return
	}

	// ── Write Dockerfile ──────────────────────────────────────────────────
	flinkBase := req.FlinkBaseImage
	if flinkBase == "" {
		flinkBase = "flink:2.2.1"
	}
	dockerfile := fmt.Sprintf(`ARG FLINK_BASE_IMAGE=%s
FROM ${FLINK_BASE_IMAGE}
USER root
RUN mkdir -p /opt/rayflow/usrlib /opt/rayflow/jobs
COPY rayflow-flink-sql-runner.jar /opt/rayflow/usrlib/rayflow-flink-sql-runner.jar
COPY job.sql /opt/rayflow/jobs/job.sql
LABEL org.opencontainers.image.vendor="RayFlow"
LABEL com.rayflow.job.type="flink-sql"
`, flinkBase)
	if err := os.WriteFile(filepath.Join(workDir, "Dockerfile"), []byte(dockerfile), 0644); err != nil {
		fail(task, &logBuf, "failed to write Dockerfile: "+err.Error())
		return
	}

	// ── Write credentials to ~/.docker/config.json (no docker login needed)
	// BuildKit reads auth directly from config.json, no daemon involvement.
	// This also works for insecure HTTP registries.
	if req.Username != "" && req.Password != "" {
		appendLog("[worker] writing registry credentials to ~/.docker/config.json")
		if err := writeDockerAuth(req.RegistryAuthority, req.Username, req.Password); err != nil {
			fail(task, &logBuf, "failed to write docker auth: "+err.Error())
			return
		}
	}

	// ── Buildx builder ────────────────────────────────────────────────────
	// For insecure (HTTP) registries we need a task-specific builder so
	// that buildkitd.toml with "http=true" is applied. The persistent
	// default builder cannot be reconfigured per-task.
	builderName := "rayflow-worker-builder"
	customBuilder := false

	if req.InsecureRegistry {
		// Write buildkitd.toml for this insecure registry
		toml := fmt.Sprintf(`[registry."%s"]
  http = true
  insecure = true
`, req.RegistryAuthority)
		tomlPath := filepath.Join(workDir, "buildkitd.toml")
		if err := os.WriteFile(tomlPath, []byte(toml), 0644); err != nil {
			fail(task, &logBuf, "failed to write buildkitd.toml: "+err.Error())
			return
		}

		// Create a task-specific builder with this config
		builderName = "rayflow-insecure-" + req.TaskID[:8]
		customBuilder = true

		createArgs := []string{
			"buildx", "create",
			"--name", builderName,
			"--driver", "docker-container",
			"--config", tomlPath,
		}
		if req.BuildProxy != "" {
			createArgs = append(createArgs,
				"--driver-opt", "env.http_proxy="+req.BuildProxy,
				"--driver-opt", "env.https_proxy="+req.BuildProxy,
				"--driver-opt", "env.no_proxy="+req.RegistryAuthority,
			)
		}
		appendLog("[worker] creating insecure-registry builder: " + builderName)
		out, err := runCmd(workDir, append([]string{"docker"}, createArgs...)...)
		appendLog(out)
		if err != nil {
			// fall back to default builder
			appendLog("[worker] WARN: builder creation failed, falling back to default builder")
			builderName = "default"
			customBuilder = false
		}
	}

	// Clean up task-specific builder when done
	if customBuilder {
		defer func() {
			out, _ := runCmd(workDir, "docker", "buildx", "rm", "--force", builderName)
			if out != "" {
				log.Printf("[worker] builder cleanup %s: %s", builderName, out)
			}
		}()
	}

	// ── docker buildx build --push ────────────────────────────────────────
	metadataFile := filepath.Join(workDir, "metadata.json")
	buildArgs := []string{
		"buildx", "build",
		"--builder", builderName,
		"--push",
		"--metadata-file", metadataFile,
		"--build-arg", "FLINK_BASE_IMAGE=" + flinkBase,
		"-t", imageRef,
		".",
	}
	appendLog("[worker] running docker buildx build --push (builder=" + builderName + ")")
	out, err := runCmd(workDir, append([]string{"docker"}, buildArgs...)...)
	appendLog(out)
	if err != nil {
		fail(task, &logBuf, "docker buildx build failed: "+err.Error())
		return
	}

	digest := extractDigest(metadataFile, imageRef)
	task.Status = "SUCCEEDED"
	task.ImageURI = imageRef
	task.ImageDigest = digest
	task.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	task.Log = truncateLog(logBuf.String(), 64*1024)
	storeTask(task)
	log.Printf("[worker] task %s SUCCEEDED image=%s digest=%s", req.TaskID, imageRef, digest)
}

// ──────────────────────────────────────────────
// Docker credentials helper
// ──────────────────────────────────────────────

// writeDockerAuth writes registry credentials directly to ~/.docker/config.json.
// BuildKit reads auth from this file without going through the docker daemon,
// so this works even for insecure (HTTP) registries.
func writeDockerAuth(registry, username, password string) error {
	auth := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))

	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "/root"
	}
	configDir := filepath.Join(homeDir, ".docker")
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return err
	}

	configPath := filepath.Join(configDir, "config.json")
	config := map[string]interface{}{}
	if data, err := os.ReadFile(configPath); err == nil {
		_ = json.Unmarshal(data, &config)
	}

	auths, _ := config["auths"].(map[string]interface{})
	if auths == nil {
		auths = map[string]interface{}{}
	}
	auths[registry] = map[string]interface{}{"auth": auth}
	config["auths"] = auths

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, data, 0600)
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

func buildImageRef(req BuildRequest) string {
	ns := ""
	if req.NamespaceName != "" {
		ns = req.NamespaceName + "/"
	}
	// image 名 = 作业名 slug，tag = v{版本号}
	// 结果示例: 192.168.103.162:8088/rayflow/flink-k8s-sql-datagen-demo:v3
	return fmt.Sprintf("%s/%s%s:v%d",
		req.RegistryAuthority, ns, slugify(req.JobName), req.VersionNo)
}

func slugify(name string) string {
	var sb strings.Builder
	for _, ch := range strings.ToLower(name) {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '.' || ch == '_' || ch == '-' {
			sb.WriteRune(ch)
		} else {
			sb.WriteRune('-')
		}
	}
	s := strings.Trim(sb.String(), "-")
	if s == "" {
		return "job"
	}
	return s
}

func fail(task *TaskStatus, logBuf *strings.Builder, msg string) {
	logBuf.WriteString("[worker] ERROR: " + msg + "\n")
	task.Status = "FAILED"
	task.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	task.Log = truncateLog(logBuf.String(), 64*1024)
	storeTask(task)
	log.Printf("[worker] task %s FAILED: %s", task.TaskID, msg)
}

func runCmd(workDir string, command ...string) (string, error) {
	cmd := exec.Command(command[0], command[1:]...)
	cmd.Dir = workDir
	out, err := cmd.CombinedOutput()
	output := string(out)
	if err != nil {
		return output, fmt.Errorf("exit %v: %s", err, output)
	}
	return output, nil
}

func extractDigest(metadataFile, imageRef string) string {
	data, err := os.ReadFile(metadataFile)
	if err != nil {
		return ""
	}
	content := string(data)
	marker := `"containerimage.digest":"`
	start := strings.Index(content, marker)
	if start < 0 {
		return ""
	}
	start += len(marker)
	end := strings.Index(content[start:], `"`)
	if end < 0 {
		return ""
	}
	digest := content[start : start+end]
	if digest != "" {
		return imageRef + "@" + digest
	}
	return ""
}

func truncateLog(s string, maxBytes int) string {
	if len(s) <= maxBytes {
		return s
	}
	return s[len(s)-maxBytes:]
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

func main() {
	port := os.Getenv("WORKER_PORT")
	if port == "" {
		port = "8090"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/build", handleBuild)
	mux.HandleFunc("/api/tasks/", handleGetTask)
	log.Printf("rayflow-worker listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
