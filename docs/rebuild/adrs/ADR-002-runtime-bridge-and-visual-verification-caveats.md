# ADR-002: Runtime bridge bootstrap and visual verification caveats

- Status: Accepted
- Date: 2026-03-31
- Owners: rebuild project team

## Context

The control-plane expects sandboxes to run a bridge process that reconnects to session WebSocket
channels and streams runtime events. The migration to Vercel Sandbox introduces a compatibility
service that must bootstrap repository state and optional runtime commands.

Visual/browser verification must continue to work for web-focused session tasks.

## Decision

1. Use environment-driven bootstrap hooks in `@open-inspect/vercel-infra`:
   - `OPENINSPECT_BOOTSTRAP_CMD`
   - `OPENINSPECT_BRIDGE_BOOT_CMD`
2. Treat runtime bridge startup as explicit deployment configuration rather than hard-coded logic in
   service code.
3. Keep visual verification support tied to bootstrap/runtime image setup for the pilot repository.

## Alternatives Considered

- Hard-code bridge startup commands in service code:
  - Rejected due to poor portability across repositories.
- Defer bridge startup to per-session manual commands:
  - Rejected due to poor reliability and operator burden.

## Consequences

- Positive:
  - Fast, reversible migration path.
  - Repo-specific runtime customization remains possible.
- Negative:
  - Requires careful environment configuration during deployment.
  - Validation must verify command wiring per environment.

## Reversibility

- Roll back by switching provider selection to Modal path.
- Replace bootstrap commands without code changes.
