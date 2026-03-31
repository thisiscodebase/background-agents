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

## Required Environment Variables

- `SANDBOX_API_SECRET` - shared HMAC secret for internal auth.

## Optional Environment Variables

- `OPENINSPECT_GITHUB_TOKEN` - token for cloning private repositories.
- `OPENINSPECT_BOOTSTRAP_CMD` - command run during bootstrap.
- `OPENINSPECT_BRIDGE_BOOT_CMD` - command used to start runtime bridge process.

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
