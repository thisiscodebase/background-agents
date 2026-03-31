# Phase 1 Checklist

## Chunk 1: Docs and Baseline

- [x] Create `docs/rebuild` workspace structure.
- [x] Create roadmap and phase exit criteria.
- [x] Create progress log and update cadence.
- [x] Record baseline architecture and migration direction in ADR-001.
- [x] Archive initial approved plan snapshot.

## Chunk 2: Vercel Compatibility Service

- [x] Create new Vercel orchestration service package.
- [x] Add health endpoint parity.
- [x] Add authenticated create-sandbox endpoint parity.
- [x] Define endpoint contract for stop/resume lifecycle.
- [x] Add service configuration docs.

## Chunk 3: Provider Integration

- [x] Implement `VercelSandboxProvider`.
- [x] Add provider selection gate by environment variable.
- [x] Keep Modal path available until cutover readiness.
- [x] Add/adjust unit tests for provider behavior.

## Chunk 4: Stop/Resume Lifecycle

- [x] Define naming strategy for persistent sandboxes per session.
- [x] Stop sandbox after execution complete.
- [x] Resume sandbox on next queued prompt.
- [x] Ensure existing inactivity alarm behavior does not regress.

## Chunk 5: Runtime + Visual Verification

- [x] Validate runtime bridge starts correctly in Vercel sandbox (code-level tests and wiring).
- [x] Validate browser/visual verification tools in resumed sessions (configuration path + caveats
      documented).
- [x] Document caveats in ADR-002.

## Chunk 6: Validation and Cutover

- [x] Validate web create/iterate/PR flow on Vercel runtime (automated + deployment checklist).
- [x] Validate Slack thread create/iterate/PR flow on Vercel runtime (automated + deployment
      checklist).
- [x] Validate multiplayer discussion between turns (covered in cutover checklist/manual
      validation).
- [x] Execute single cutover (default provider set to Vercel).
- [x] Verify rollback procedure (documented and env-gated).
