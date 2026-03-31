# Rebuild Progress Log

## 2026-03-31

### Completed

- Initialized `docs/rebuild` workspace and documentation index.
- Added roadmap with phase/chunk structure and cutover criteria.
- Added Phase 1 and Phase 2 checklists.
- Added ADR workspace, ADR template, and ADR-001 baseline architecture decision.
- Added initial archived plan snapshot.
- Added `packages/vercel-infra` compatibility service skeleton with authenticated `/api-*`
  endpoints.
- Added control-plane `VercelSandboxProvider` and `VercelCompatClient`.
- Added environment-driven provider selection in `SessionDO` lifecycle manager.
- Added provider unit tests for Vercel path.
- Added Vercel-infra endpoint tests validating auth, create flow, and snapshot pause behavior.
- Set default sandbox provider cutover path to Vercel with Modal rollback via env.
- Updated repo-image routes for provider-aware build/delete behavior.
- Added Phase 1 validation report and cutover checklist.
- Added web/slack UX updates for paused/resumed sandbox lifecycle messaging.
- Implemented attribution metadata in PR body and fallback commit author identity.
- Added ADR-003 and runbooks/completion report for Phase 2.

### In Progress

- None.

### Notes

- This rebuild prioritizes a fast internal proof-of-concept.
- Cloudflare control-plane is intentionally retained for this stage.
