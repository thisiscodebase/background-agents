# Vercel Infra Compatibility Service

This package provides a Modal-compatible HTTP surface backed by Vercel Sandbox APIs.

## Purpose

- Let control-plane migrate runtime providers with minimal endpoint contract changes.
- Support phased migration by preserving existing `/api-*` request/response envelopes.

## Endpoints

- `GET /api-health`
- `POST /api-create-sandbox`
- `POST /api-restore-sandbox`
- `POST /api-snapshot-sandbox`
- `POST /api-warm-sandbox`
- `POST /api-build-repo-image`
- `POST /api-delete-provider-image`
- `POST /api-debug-sandbox` (internal diagnostics endpoint)

## Required Environment Variables

- `SANDBOX_API_SECRET` - shared HMAC secret for inbound calls to this service (must match
  control-plane `SANDBOX_API_SECRET`).
- `INTERNAL_CALLBACK_SECRET` - same value as control-plane `INTERNAL_CALLBACK_SECRET`; used to sign
  `POST` callbacks to `/repo-images/build-complete` and `/repo-images/build-failed` on the worker.

## Optional Environment Variables

- `OPENINSPECT_GITHUB_TOKEN` - token for cloning private repositories.
- `OPENINSPECT_BOOTSTRAP_CMD` - command run during bootstrap.
- `OPENINSPECT_BRIDGE_BOOT_CMD` - command used to start runtime bridge process.
- `OPENINSPECT_SANDBOX_RUNTIME_PIP_SPEC` - optional fallback pip spec used when `sandbox_runtime` is
  missing from the cloned repo (for example:
  `git+https://...#subdirectory=packages/sandbox-runtime`).
- `OPENINSPECT_VERCEL_INFRA_VERBOSE=1` - log shell command previews and GET-miss error details
  (noisier).
- `OPENINSPECT_SANDBOX_CMD_LOG=1` - after each `bash -lc` in the sandbox, log **stdout** and
  **stderr** (truncated) to **Vercel Runtime Logs** as JSON (`event":"shell_command_output"`). The
  hosted Sandbox UI only shows “Executed bash”; this is how you see what actually ran. **Warning:**
  output may include secrets if your scripts print them.

## Debugging

**Vercel “External APIs” is not the whole story.** The platform also logs your function’s
`console.log` / `console.error`. This service emits **JSON lines** with `"service":"vercel-infra"`
and an `"event"` field so you can filter Runtime Logs (e.g. search `sandbox_resumed` or
`api_create_sandbox_ok`).

**GET `/sandboxes/…` → 404 then POST create → 200 is normal** for a new persistent name.
`getOrCreatePersistentSandbox` calls `Sandbox.get` first; a miss (often 404) means we call
`Sandbox.create`. You should see `sandbox_get_miss` then `sandbox_created` in logs, or
`sandbox_resumed` when reusing an existing VM.

**Correlate with Cloudflare**

- Control plane logs `session_id` (user-facing id) and `provider_object_id` / persistent name
  `oi-session-<session_id>`.
- Vercel logs the same `persistent_sandbox_name` and `session_id` on `api_create_sandbox_*` events.
- Optional: match **Vercel** `x-invocation-id` / **Cloudflare** `x-vercel-id` / **CF** `cf-ray` when
  tracing a single user action across services.

## Deploying on Vercel

This package includes:

- `api/[...path].ts` - Vercel catch-all entrypoint for Hono
- `vercel.json` - rewrites that map root Modal-compatible paths to `/api/*`

Recommended deploy shape:

1. Create a Vercel project with root directory `packages/vercel-infra`, framework **Other** (or
   leave defaults; `vercel.json` sets `outputDirectory` to `public` for the static placeholder).
2. Set `SANDBOX_API_SECRET` (required)
3. Set `OPENINSPECT_GITHUB_TOKEN` for private repositories
4. Deploy and use the resulting URL as control-plane `SANDBOX_API_BASE_URL`
