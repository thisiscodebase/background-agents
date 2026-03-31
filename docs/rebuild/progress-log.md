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
- **Web → control plane auth (Vercel):** API route handlers use `getRouteAuthToken` from
  `packages/web/src/lib/route-auth.ts` instead of `getServerSession`. NextAuth v4 + App Router often
  leaves `cookies()` / `NextRequest.cookies` empty for client `fetch` while `/api/auth/session`
  still works; the helper merges the raw `Cookie` header with adapter cookies and calls `getToken`,
  with a secure / non-secure session-cookie name fallback.
- **Troubleshooting doc:** Extended `runbook-troubleshooting.md` with how to tell **NextAuth 401**
  from **control-plane internal HMAC 401** using Vercel and Cloudflare logs.

### In Progress

- None.

### Notes

- This rebuild prioritizes a fast internal proof-of-concept.
- Cloudflare control-plane is intentionally retained for this stage.
- **`INTERNAL_CALLBACK_SECRET`:** Must match exactly between the **Vercel web** project
  (`INTERNAL_CALLBACK_SECRET`) and the **control-plane worker** (`internal_callback_secret` in
  Terraform / worker secret). A typo produces **401** with body `{"error":"Unauthorized"}` from the
  worker; Vercel logs may show `Control plane API error: {"error":"Unauthorized"}` for `/api/repos`
  and similar. That is **not** a NextAuth failure.
- **`cloudflare_worker_subdomain`:** Use only the Workers **subdomain label** (for example
  `myaccount`), not `myaccount.workers.dev`. Appending `.workers.dev` in tfvars doubles the suffix
  in generated URLs and worker env vars (`WORKER_URL`, `CONTROL_PLANE_URL` on Vercel, etc.).
