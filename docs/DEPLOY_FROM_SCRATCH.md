# Open-Inspect From-Scratch Deploy Guide

This guide is for a brand-new deployment when you currently only have a Vercel account.

Target result:

- Web app running on Vercel
- Control plane running on Cloudflare Workers + Durable Objects + D1
- Runtime orchestration through Vercel Sandbox (`packages/vercel-infra`)
- Optional Slack bot integration for thread-based agent sessions

This is a single-tenant internal deployment.

## 0) What You Need

### Accounts

Create these before starting:

- Vercel (you already have this)
- Cloudflare
- GitHub (org or user account that owns target repos)
- Anthropic (or OpenAI, if you plan to use OpenAI models)
- Slack (optional, if you want Slack integration)

### Local Tools

Install:

```bash
brew install node@22 terraform
npm install -g wrangler vercel
```

Confirm:

```bash
node -v
npm -v
terraform -version
wrangler --version
vercel --version
```

## 1) Clone and Bootstrap

```bash
git clone https://github.com/<your-org-or-user>/background-agents.git
cd background-agents
npm install
npm run build -w @open-inspect/shared
```

## 2) Create Cloudflare Credentials + Terraform State Bucket

1. In Cloudflare dashboard:
   - Copy your **Account ID**
   - Note your **Workers subdomain** (the `xxx` in `xxx.workers.dev`)
2. Create a Cloudflare API token with permissions for Workers, D1, KV, and R2.
3. Login and create Terraform state bucket:

```bash
wrangler login
wrangler r2 bucket create open-inspect-terraform-state
```

4. Create an R2 API token with Object Read/Write and save:
   - `access_key`
   - `secret_key`

## 3) Create a GitHub App (OAuth + Repo Access)

Create one GitHub App for both sign-in and repository operations.

Required settings:

- Callback URL:
  - `https://open-inspect-<deployment_name>.vercel.app/api/auth/callback/github`
- Repository permissions:
  - Contents: Read & Write
  - Pull requests: Read & Write
  - Metadata: Read-only
- Generate:
  - Client ID
  - Client Secret
  - App ID
  - Private key (convert to PKCS#8)
  - Installation ID (after installing app on your org/repo set)

Convert private key:

```bash
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
  -in ~/Downloads/<github-app-key>.pem \
  -out private-key-pkcs8.pem
```

## 4) Deploy `vercel-infra` (Vercel Sandbox Compat API)

Create a new Vercel project:

- Import this repository
- Set **Root Directory** to `packages/vercel-infra`
- Framework preset: Other

Add environment variables in that Vercel project:

- `SANDBOX_API_SECRET` (generate with `openssl rand -hex 32`)
- `OPENINSPECT_GITHUB_TOKEN` (recommended for private repos)
- `OPENINSPECT_BOOTSTRAP_CMD` (optional override)
- `OPENINSPECT_BRIDGE_BOOT_CMD` (optional override)

Deploy, then copy the production URL, for example:

- `https://open-inspect-vercel-infra-<name>.vercel.app`

Quick health check:

```bash
curl https://<your-vercel-infra-domain>/api-health
```

### Web app (`packages/web`) on Vercel

The web app depends on `@open-inspect/shared` via `file:../shared`. A Vercel build that only uploads
**`packages/web`** (for example `vercel --prod` with “code located `./`” and no Git checkout of the
full monorepo) will fail with **Can't resolve '@open-inspect/shared'**.

Do this instead:

1. **Connect the Vercel project to this Git repository** (Import Project → your repo).
2. Set **Root Directory** to `packages/web`.
3. Keep the default install/build; `packages/web/vercel.json` runs `npm install` at the **repo
   root** and builds shared first
   (`cd ../.. && npm install && npm run build -w @open-inspect/shared`, then `npm run build` in the
   app).

If you use the CLI, link the project to the same Git-backed setup and deploy via **git push** or
dashboard **Redeploy** so the full monorepo is present on the build machine—not a sparse upload of
`packages/web` only.

## 5) Prepare Terraform Config

```bash
cd terraform/environments/production
cp terraform.tfvars.example terraform.tfvars
cp backend.tfvars.example backend.tfvars
```

Update `backend.tfvars`:

```hcl
access_key = "<r2-access-key>"
secret_key = "<r2-secret-key>"
endpoints = {
  s3 = "https://<cloudflare-account-id>.r2.cloudflarestorage.com"
}
```

Update `terraform.tfvars` (minimum required for Vercel Sandbox path):

```hcl
# Cloudflare
cloudflare_api_token        = "<token>"
cloudflare_account_id       = "<account-id>"
cloudflare_worker_subdomain = "<workers-subdomain>"

# Vercel (web app deployment target)
vercel_api_token = "<vercel-token>"
vercel_team_id   = "<team-or-account-id>"
web_platform     = "vercel"

# Runtime provider
sandbox_provider     = "vercel"
sandbox_api_base_url = "https://<your-vercel-infra-domain>"
sandbox_api_secret   = "<same-as-vercel-infra-SANDBOX_API_SECRET>"

# GitHub app credentials
github_client_id             = "<client-id>"
github_client_secret         = "<client-secret>"
github_app_id                = "<app-id>"
github_app_installation_id   = "<installation-id>"
github_app_private_key       = <<-EOF
-----BEGIN PRIVATE KEY-----
<pkcs8-private-key>
-----END PRIVATE KEY-----
EOF

# AI keys
anthropic_api_key = "<anthropic-key>"
# Optional: OpenAI platform API for GPT/Codex in sandboxes (see docs/OPENAI_MODELS.md)
# openai_api_key = "<openai-key>"

# Required secrets
token_encryption_key        = "<openssl rand -base64 32>"
repo_secrets_encryption_key = "<openssl rand -base64 32>"
internal_callback_secret    = "<openssl rand -base64 32>"
nextauth_secret             = "<openssl rand -base64 32>"

# Optional integrations
enable_slack_bot  = false
enable_linear_bot = false

# Naming
deployment_name = "<unique-name>"
```

Notes:

- Leave legacy Modal values empty when `sandbox_provider = "vercel"`.
- If your repos are private, make sure `OPENINSPECT_GITHUB_TOKEN` is set in `vercel-infra`.

## 6) Terraform Deploy (2 Phases)

From `terraform/environments/production`:

```bash
terraform init -backend-config=backend.tfvars
```

Phase 1:

```bash
terraform apply
```

Then set in `terraform.tfvars`:

```hcl
enable_durable_object_bindings = true
enable_service_bindings         = true
```

Phase 2:

```bash
terraform apply
```

## 7) Post-Deploy Verification

Use `terraform output` and verify:

```bash
# Control plane
curl https://<control-plane-workers-url>/health

# Web app
curl https://open-inspect-<deployment_name>.vercel.app

# Runtime compat API
curl https://<your-vercel-infra-domain>/api-health
```

Then do a real smoke test in UI:

1. Sign in with GitHub
2. Create session on a target repo
3. Send one prompt
4. Confirm events stream and run completes
5. Request a PR and verify attribution metadata on PR body

## 8) Enable Slack (Optional)

1. Create Slack app
2. Add bot scopes (`app_mentions:read`, `chat:write`, `channels:history`, `groups:history`,
   `im:history`, `reactions:write`, plus corresponding `*:read`)
3. Install app to workspace
4. Put secrets in `terraform.tfvars`:
   - `enable_slack_bot = true`
   - `slack_bot_token`
   - `slack_signing_secret`
5. `terraform apply`
6. Configure Slack Event Subscriptions Request URL to:
   - `https://<slack-bot-worker-url>/slack/events`

## 9) Common Gotchas

- GitHub OAuth callback URL must exactly match deployed web URL.
- `sandbox_api_secret` in Terraform must match `SANDBOX_API_SECRET` in `vercel-infra`.
- If sandbox creation fails on private repos, set `OPENINSPECT_GITHUB_TOKEN` in `vercel-infra`.
- If DO/session routes fail after first deploy, run second-phase apply with DO/service bindings
  enabled.

## 10) Rollback Strategy

If runtime issues appear:

1. Set `sandbox_provider = "modal"` (only if your Modal path is configured)
2. `terraform apply`
3. Keep `vercel-infra` deployed for future retest

For the full migration/runbook workflow, see:

- `docs/rebuild/cutover-checklist.md`
- `docs/rebuild/runbook-deploy-and-rollback.md`
- `docs/rebuild/runbook-troubleshooting.md`
