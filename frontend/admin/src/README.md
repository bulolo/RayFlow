# Frontend Architecture

## Layering

- `app/`: route entry, layout, page-level composition only
- `features/`: business modules grouped by domain, owning feature UI and local logic
- `components/`: shared presentational building blocks
- `shared/`: cross-feature infrastructure such as API, auth persistence, tenant persistence
- `stores/`: global client state with clear ownership boundaries
- `lib/`: generated SDK, app utilities, and narrow infrastructure adapters

## Import Rules

- Prefer `@/shared/api/generated` for generated contracts and hooks.
- Prefer `@/shared/*` for cross-feature browser persistence and request infrastructure.
- Prefer `@/features/<domain>/*` for feature-local utilities instead of adding new generic helpers under `lib/`.
- Do not import feature internals across domains unless the target is intentionally shared.

## State Rules

- Persisted auth state belongs in `auth-store` and `shared/auth/session`.
- Persisted tenant selection belongs in `tenant-store` and `shared/tenant/storage`.
- Pure UI shell state belongs in `ui-store`.
- Temporary screen state should stay inside the owning feature component or feature hook.

## File Organization

- Extract components when a single file starts mixing page orchestration and detailed table/editor rendering.
- Extract hooks when the logic is reusable or obscures the primary UI flow.
- Keep generated SDK imports routed through `@/shared/api/generated` so generator changes do not cascade through features.

## Production Baseline

- `pnpm lint`
- `pnpm typecheck`
- `pnpm check`

Any new architectural refactor should keep all three green.
