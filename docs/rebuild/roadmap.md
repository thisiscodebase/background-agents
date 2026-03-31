# Modal -> Vercel Sandbox Roadmap

## Objectives

1. Replace Modal execution runtime with Vercel Sandbox while keeping Cloudflare control-plane.
2. Preserve web + Slack workflows for internal non-technical users.
3. Enforce stop-between-turns and resume-on-next-turn lifecycle.
4. Reach a single production cutover with documented rollback.

## Scope

### In Scope

- Vercel-backed runtime orchestration compatibility service.
- `VercelSandboxProvider` alongside existing Modal provider.
- Persistent sandbox stop/resume behavior.
- Web and Slack user experience hardening.
- Minimal repo prebuild baseline for the pilot repository.

### Out of Scope

- Full control-plane replatform off Cloudflare.
- Linear and GitHub bot parity work (unless needed for regression safety).
- Multi-tenant product model redesign.

## Delivery Chunks

### Phase 1 (Runtime Migration and Validation)

1. Docs bootstrap, baseline ADR, acceptance criteria.
2. Vercel compatibility orchestration service skeleton.
3. Control-plane provider integration.
4. Stop/resume lifecycle policy implementation.
5. Runtime bridge + visual verification readiness.
6. Validation and single cutover.

### Phase 2 (Product Hardening)

7. Minimal repo prebuild baseline and scheduled refresh.
8. Slack + web UX reliability pass for paused/resumed lifecycle.
9. Attribution model decision and implementation for non-GitHub users.
10. Operability docs and completion reporting.

## Phase Exit Criteria

### Exit Phase 1

- Web and Slack sessions run end-to-end on Vercel-backed runtime.
- Sandboxes stop after each turn and resume with prior session state.
- Visual verification path is functional in resumed sessions.
- Single provider cutover and rollback rehearsal complete.
- Rebuild docs are current.

### Exit Phase 2

- Pilot repo prebuild baseline is operational.
- Slack + web lifecycle messaging is clear and reliable.
- Attribution approach is implemented and documented.
- Runbook-level operational guidance is complete.

## Cutover Acceptance Criteria

- Create session, prompt, iterate, and request PR from web.
- Create session, prompt, iterate, and request PR from Slack thread.
- Collaborators can review and add follow-up prompts between turns.
- No required manual sandbox babysitting to progress a thread.
- Core failure scenarios have documented mitigation and rollback.
