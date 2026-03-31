# Cutover Checklist (Modal -> Vercel Runtime)

## Preconditions

- Control-plane deploy includes:
  - `VercelSandboxProvider`
  - `VercelCompatClient`
  - provider selection gate with default `vercel`
- Compatibility service deployed and reachable at `SANDBOX_API_BASE_URL`.
- Shared internal auth secret configured on both sides:
  - control-plane `SANDBOX_API_SECRET`
  - vercel-infra `SANDBOX_API_SECRET`

## Readiness Checks

- Typecheck passes:
  - `@open-inspect/control-plane`
  - `@open-inspect/vercel-infra`
- Tests pass:
  - `packages/vercel-infra/src/index.test.ts`
  - `packages/control-plane/src/sandbox/providers/vercel-provider.test.ts`
  - `packages/control-plane/src/session/pull-request-service.test.ts`
- Validation report updated: `validation-phase-1.md`.

## Cutover

1. Deploy compatibility service (`@open-inspect/vercel-infra`).
2. Set control-plane environment:
   - `SANDBOX_PROVIDER=vercel`
   - `SANDBOX_API_BASE_URL=<deployed service url>`
   - `SANDBOX_API_SECRET=<shared secret>`
3. Deploy control-plane.
4. Validate web and Slack prompt flow.
5. Validate create PR flow.

## Rollback

1. Set `SANDBOX_PROVIDER=modal`.
2. Ensure Modal env vars are present:
   - `MODAL_API_SECRET`
   - `MODAL_WORKSPACE`
3. Redeploy control-plane.
4. Confirm sandbox spawn + prompt processing with Modal path.

## Post-cutover Monitoring

- Error rate for sandbox spawn/restore endpoints.
- Prompt completion latency.
- Callback success for Slack completion messages.
- Repo image build callback success rate.
