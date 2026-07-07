# ── Stage 1: Build the Go HTTP server ──────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /src
COPY go.mod .
COPY main.go .

# Build a static binary (no CGO, works in Alpine/scratch)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /app/worker .

# ── Stage 2: Runtime (Docker-in-Docker) ────────────────────────────────────
# docker:dind provides dockerd + docker CLI + buildx plugin
FROM docker:27-dind

# Copy the compiled worker binary and entrypoint
COPY --from=builder /app/worker /app/worker
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh /app/worker

# Worker HTTP port
EXPOSE 8090

# DOCKER_TLS_CERTDIR="" disables TLS for internal DinD (safe inside compose network)
ENV DOCKER_TLS_CERTDIR=""

ENTRYPOINT ["/entrypoint.sh"]
