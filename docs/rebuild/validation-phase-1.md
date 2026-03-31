# Phase 1 Validation Report

Date: 2026-03-31

## Automated Validation Executed

- `npm run build -w @open-inspect/shared`
- `npm run typecheck -w @open-inspect/vercel-infra`
- `npm run typecheck -w @open-inspect/control-plane`
- `npm run test -w @open-inspect/control-plane -- src/sandbox/providers/vercel-provider.test.ts`

## New Validation Coverage Added

- `packages/vercel-infra/src/index.test.ts`
  - Auth required for create endpoint
  - Create flow returns compatible response shape
  - Snapshot endpoint pauses sandbox (stop call) and returns persistent snapshot ref

## Functional Assertions Covered

- Compatibility API returns expected envelope format (`success`, `data`, `error`).
- Control-plane has a Vercel provider path selectable through environment configuration.
- Snapshot flow for Vercel compatibility path pauses compute and produces a resume reference.

## Manual Validation Remaining (Deployment Environment)

- Web create/iterate/PR against deployed Vercel-infra runtime.
- Slack thread create/iterate/PR against deployed Vercel-infra runtime.
- Multiplayer discussion between turns before re-invocation.
- Visual verification workflow against pilot repository runtime configuration.

## Current Assessment

- Code-level migration path is in place and typechecked.
- End-to-end runtime behavior now depends on deployment configuration of:
  - `SANDBOX_PROVIDER=vercel`
  - `SANDBOX_API_BASE_URL`
  - `SANDBOX_API_SECRET`
  - `OPENINSPECT_BOOTSTRAP_CMD`
  - `OPENINSPECT_BRIDGE_BOOT_CMD`
