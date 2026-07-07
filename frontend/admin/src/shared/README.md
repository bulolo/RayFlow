# Frontend Shared Layer

This directory holds cross-feature primitives and infrastructure:

- `api/`: request client, generated API exports, API adapters
- `auth/`: session persistence and auth-side browser utilities
- `tenant/`: tenant selection persistence
- `ui/`: cross-feature display helpers beyond `components/ui`
- `types/`: future shared domain types that should not live under a single feature

Frontend rules:

- Feature modules import generated SDK hooks and types from `@/shared/api/generated`.
- `@/lib/sdk` is generated code and should only be re-exported by the shared API layer.
- `@/lib/*` holds small app infrastructure such as `utils`, `error-message`, and app config.
- Cross-feature UI helpers belong in `shared/ui`; feature-specific UI stays inside its feature module.
- Avoid production imports from files named `mock`; empty states should be explicit in the consuming feature.
