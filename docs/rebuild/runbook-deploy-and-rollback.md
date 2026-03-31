# Deploy and Rollback Runbook

## Deploy Sequence

1. Build shared package:
   - `npm run build -w @open-inspect/shared`
2. Validate key packages:
   - `npm run typecheck -w @open-inspect/control-plane`
   - `npm run typecheck -w @open-inspect/vercel-infra`
3. Deploy compatibility service (`@open-inspect/vercel-infra`).
4. Deploy control-plane with Vercel runtime env vars.
5. Smoke test:
   - create session from web
   - create session from Slack thread
   - run one prompt + one follow-up prompt
   - request PR

## Required Runtime Variables

### Control-plane

- `SANDBOX_PROVIDER=vercel`
- `SANDBOX_API_BASE_URL`
- `SANDBOX_API_SECRET`
- `WORKER_URL`

### Vercel-infra

- `SANDBOX_API_SECRET`
- `OPENINSPECT_GITHUB_TOKEN` (if private repos)
- `OPENINSPECT_BOOTSTRAP_CMD` (optional)
- `OPENINSPECT_BRIDGE_BOOT_CMD` (optional, recommended)

## Rollback Trigger Conditions

- Sandbox creation failures > acceptable threshold.
- Inability to process follow-up prompts after first completion.
- PR creation path broken in production flow.

## Rollback Procedure

1. Change control-plane `SANDBOX_PROVIDER` to `modal`.
2. Verify Modal credentials are present.
3. Redeploy control-plane.
4. Re-run smoke test with one web and one Slack session.
5. Log incident and postmortem entry in `progress-log.md`.
