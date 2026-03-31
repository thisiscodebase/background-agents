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
