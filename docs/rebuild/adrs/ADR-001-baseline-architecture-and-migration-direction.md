# ADR-001: Baseline architecture and migration direction

- Status: Accepted
- Date: 2026-03-31
- Owners: rebuild project team

## Context

The current platform uses:

- Cloudflare control-plane (`Durable Objects`, `D1`, WebSocket hibernation).
- Modal data-plane for sandbox creation, snapshots, and repo-image build workflows.
- Web and Slack as primary user surfaces for session creation and iteration.

The project goal is to prove internal value quickly for non-technical users while reducing
multi-service operational burden over time.

## Decision

For Phase 1-2, we will:

1. Keep Cloudflare control-plane intact.
2. Replace Modal runtime orchestration with a Vercel Sandbox-backed compatibility service.
3. Add `VercelSandboxProvider` parallel to `ModalSandboxProvider`.
4. Use stop-after-turn and resume-on-next-turn behavior using persistent sandbox semantics.
5. Focus UX reliability work on web and Slack.

## Alternatives Considered

- Full Cloudflare + Modal replacement in one effort:
  - Rejected for now due to higher risk and longer time to value.
- Keep Modal and optimize around it:
  - Rejected because priority is proving Vercel-backed runtime viability.

## Consequences

- Positive:
  - Fastest path to a working proof-of-concept on Vercel runtime.
  - Lower blast radius by avoiding control-plane rewrite.
  - Reversible provider-level migration path.
- Negative:
  - Temporary dual-runtime complexity until cutover.
  - Persistent sandbox beta behavior must be monitored.

## Reversibility

- Keep Modal provider and existing runtime path intact until cutover criteria are passed.
- If Vercel runtime fails readiness, revert provider selection and redeploy prior control-plane
  build.
