# Troubleshooting Runbook

## Symptom: Sandbox spawn fails immediately

### Checks

- `SANDBOX_PROVIDER` is set as expected.
- `SANDBOX_API_BASE_URL` is reachable from control-plane.
- `SANDBOX_API_SECRET` matches on both services.

### Actions

- Call compatibility health endpoint (`/api-health`).
- Inspect control-plane logs for provider error classification.
- If critical, rollback to Modal provider.

## Symptom: Prompt runs once, follow-up prompt does not resume

### Checks

- Snapshot endpoint is returning `image_id`.
- `sandbox_status` transitions to `stopped` after completion.
- Restore endpoint receives `snapshot_image_id`.

### Actions

- Verify compatibility endpoint `/api-snapshot-sandbox` executes sandbox stop.
- Verify next prompt path triggers spawn/restore.
- Confirm bridge bootstrap command runs on restore.

## Symptom: Slack shows completion but no useful result

### Checks

- Control-plane callback payload is signed and accepted.
- Slack completion extractor can fetch events for message id.
- Session link is accessible in web UI.

### Actions

- Verify callback signature secret alignment.
- Check event retrieval for the specific `sessionId` + `messageId`.
- Post fallback session link and inspect timeline directly.

## Symptom: Repo-image trigger succeeds but no ready image

### Checks

- Build callback route receives payload.
- `provider_image_id` is written in D1 for build id.

### Actions

- Re-run trigger endpoint manually for pilot repo.
- Inspect callback route logs and D1 status rows.
- If needed, mark stale builds and re-trigger.

## Symptom: Web UI shows empty repos / failed loads; browser 401 on `/api/repos`, `/api/sessions`, `/api/model-preferences`

Two different layers can return **401**. Use logs to see which.

### A) NextAuth rejected the request (web app, before control plane)

**Meaning:** The route handler did not get a valid session JWT (see
`packages/web/src/lib/route-auth.ts` and the `if (!token)` branch in each `app/api/**/route.ts`).

**Checks**

- In the browser, open `/api/auth/session` while signed in. If the body is `{}`, the server does not
  see a session cookie for that host.
- Vercel **Production** env: `NEXTAUTH_URL` must match the exact origin you use (scheme + host, no
  trailing slash). `NEXTAUTH_SECRET` must be stable; changing it invalidates existing cookies.
- Preview deployments: ensure preview env has compatible NextAuth vars if you test there.

**Actions**

- Sign out, clear site cookies for the app origin, sign in again after fixing env.
- Align `NEXTAUTH_URL` / `NEXTAUTH_SECRET` on the **Vercel project that serves the UI**.

### B) Control plane rejected internal HMAC (web called worker, worker returned 401)

**Meaning:** The web app **did** pass the `getRouteAuthToken` check and called `controlPlaneFetch`.
The worker’s `requireInternalAuth` failed (`verifyInternalToken` in
`packages/control-plane/src/router.ts`).

**How to recognize**

- Vercel function logs for `/api/repos` may include:
  `Control plane API error: {"error":"Unauthorized"}` — that string is logged when the **upstream**
  worker response is not OK, not when NextAuth fails.
- `[sessions:GET] ... status=401` with a non-trivial `fetch=` time usually means the **sessions**
  request to the control plane returned 401.
- Cloudflare Worker logs may show **`auth.hmac_failed`** for bad internal tokens.

**Checks**

- **`INTERNAL_CALLBACK_SECRET`** on Vercel (web) must be **identical** to the control-plane worker
  secret from Terraform (`internal_callback_secret` in `terraform.tfvars` → worker binding).
- No stray whitespace or newline when copying the secret into Vercel or tfvars.
- **`CONTROL_PLANE_URL`** on Vercel must point at the **correct** worker URL (single `.workers.dev`
  suffix; see `cloudflare_worker_subdomain` note below).

**Actions**

- Fix the secret in tfvars and/or Vercel, run `terraform apply` if the worker secret changes,
  redeploy web.
- Verify with `curl` against `/health` on the worker, then exercise the UI again.

## Symptom: Wrong or duplicate control-plane / WebSocket URLs in Terraform output or env

### Checks

- `cloudflare_worker_subdomain` in `terraform.tfvars` should be **only** the account subdomain
  string (the part before `.workers.dev`), for example `dylan-gilchrist`. Do **not** include
  `.workers.dev`; locals and modules append it.

### Actions

- Correct tfvars, `terraform apply`, then refresh Vercel env vars that Terraform manages
  (`CONTROL_PLANE_URL`, `NEXT_PUBLIC_WS_URL`, worker `WORKER_URL`, etc.).
