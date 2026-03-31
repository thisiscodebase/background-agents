# =============================================================================
# Provider Authentication
# =============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers, KV, R2, and D1 permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID (optional, for custom domains)"
  type        = string
  default     = null
}

variable "cloudflare_worker_subdomain" {
  description = "Cloudflare Workers account subdomain (e.g. 'myaccount' — .workers.dev is appended automatically)"
  type        = string
}

variable "vercel_api_token" {
  description = "Vercel API token (required only when web_platform = 'vercel')"
  type        = string
  sensitive   = true
  default     = "unused"
}

variable "vercel_team_id" {
  description = "Vercel team ID (required only when web_platform = 'vercel')"
  type        = string
  default     = "unused"
}

variable "sandbox_provider" {
  description = "Sandbox provider used by control-plane: 'vercel' or 'modal'"
  type        = string
  default     = "vercel"

  validation {
    condition     = contains(["vercel", "modal"], var.sandbox_provider)
    error_message = "sandbox_provider must be 'vercel' or 'modal'."
  }
}

variable "sandbox_api_base_url" {
  description = "Base URL for the sandbox compatibility API (required when sandbox_provider = 'vercel'). Include the scheme, e.g. https://your-infra.vercel.app — host-only values are normalized to https in the Worker, but Terraform examples use full URLs for clarity."
  type        = string
  default     = ""

  validation {
    condition     = var.sandbox_provider != "vercel" || length(trimspace(var.sandbox_api_base_url)) > 0
    error_message = "sandbox_api_base_url must be set when sandbox_provider is 'vercel'."
  }
}

variable "sandbox_api_secret" {
  description = "Shared secret for control-plane -> sandbox API auth (required when sandbox_provider = 'vercel')"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = var.sandbox_provider != "vercel" || length(trimspace(var.sandbox_api_secret)) > 0
    error_message = "sandbox_api_secret must be set when sandbox_provider is 'vercel'."
  }
}

variable "modal_token_id" {
  description = "Modal API token ID"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = var.sandbox_provider != "modal" || length(trimspace(var.modal_token_id)) > 0
    error_message = "modal_token_id must be set when sandbox_provider is 'modal'."
  }
}

variable "modal_token_secret" {
  description = "Modal API token secret"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = var.sandbox_provider != "modal" || length(trimspace(var.modal_token_secret)) > 0
    error_message = "modal_token_secret must be set when sandbox_provider is 'modal'."
  }
}

variable "modal_workspace" {
  description = "Modal workspace name (used in endpoint URLs)"
  type        = string
  default     = ""

  validation {
    condition     = var.sandbox_provider != "modal" || length(trimspace(var.modal_workspace)) > 0
    error_message = "modal_workspace must be set when sandbox_provider is 'modal'."
  }
}

# =============================================================================
# GitHub OAuth App Credentials
# =============================================================================

variable "github_client_id" {
  description = "GitHub OAuth App client ID"
  type        = string
}

variable "github_client_secret" {
  description = "GitHub OAuth App client secret"
  type        = string
  sensitive   = true
}

# =============================================================================
# GitHub App Credentials (for Modal sandbox)
# =============================================================================

variable "github_app_id" {
  description = "GitHub App ID"
  type        = string
}

variable "github_app_private_key" {
  description = "GitHub App private key (PKCS#8 format)"
  type        = string
  sensitive   = true
}

variable "github_app_installation_id" {
  description = "GitHub App installation ID"
  type        = string
}

# =============================================================================
# GitHub Bot Configuration
# =============================================================================

variable "enable_github_bot" {
  description = "Enable the GitHub bot worker. Requires github_webhook_secret and github_bot_username."
  type        = bool
  default     = false

  validation {
    condition     = var.enable_github_bot == false || (length(var.github_webhook_secret) > 0 && length(var.github_bot_username) > 0)
    error_message = "When enable_github_bot is true, github_webhook_secret and github_bot_username must be non-empty."
  }
}

variable "github_webhook_secret" {
  description = "Shared secret for verifying GitHub webhook signatures (generate with: openssl rand -hex 32)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_bot_username" {
  description = "GitHub App bot username for @mention detection (e.g., 'my-app[bot]')"
  type        = string
  default     = ""
}

# =============================================================================
# Slack App Credentials
# =============================================================================

variable "enable_slack_bot" {
  description = "Enable the Slack bot worker. Set to false to skip deployment."
  type        = bool
  default     = true

  validation {
    condition     = var.enable_slack_bot == false || (length(var.slack_bot_token) > 0 && length(var.slack_signing_secret) > 0)
    error_message = "When enable_slack_bot is true, slack_bot_token and slack_signing_secret must be non-empty."
  }
}

variable "slack_bot_token" {
  description = "Slack Bot OAuth token (xoxb-...)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "slack_signing_secret" {
  description = "Slack app signing secret"
  type        = string
  sensitive   = true
  default     = ""
}

# =============================================================================
# Linear Agent Credentials
# =============================================================================

variable "enable_linear_bot" {
  description = "Enable the Linear bot worker. Requires linear_client_id, linear_client_secret, and linear_webhook_secret."
  type        = bool
  default     = false

  validation {
    condition = var.enable_linear_bot == false || (
      length(var.linear_client_id) > 0 &&
      length(var.linear_client_secret) > 0 &&
      length(var.linear_webhook_secret) > 0
    )
    error_message = "When enable_linear_bot is true, linear_client_id, linear_client_secret, and linear_webhook_secret must be non-empty."
  }
}

variable "linear_client_id" {
  description = "Linear OAuth Application Client ID (from Settings → API → Applications)"
  type        = string
  default     = ""
}

variable "linear_client_secret" {
  description = "Linear OAuth Application Client Secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "linear_webhook_secret" {
  description = "Linear webhook signing secret (from the OAuth Application config)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "linear_api_key" {
  description = "Linear API key for fallback comment posting"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# API Keys
# =============================================================================

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "Optional OpenAI API key for GPT/Codex models in sandboxes (standard OpenAI API). Omit or leave empty to use ChatGPT OAuth repo secrets instead; see docs/OPENAI_MODELS.md."
  type        = string
  sensitive   = true
  default     = ""
}

# =============================================================================
# Security Secrets
# =============================================================================

variable "token_encryption_key" {
  description = "Key for encrypting tokens (generate with: openssl rand -base64 32)"
  type        = string
  sensitive   = true
}

variable "repo_secrets_encryption_key" {
  description = "Key for encrypting repo secrets in D1 (generate with: openssl rand -base64 32)"
  type        = string
  sensitive   = true
}

variable "internal_callback_secret" {
  description = "Shared secret for internal service communication (generate with: openssl rand -base64 32)"
  type        = string
  sensitive   = true
}

variable "modal_api_secret" {
  description = "Shared secret for authenticating control plane to Modal API calls (generate with: openssl rand -hex 32)"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = var.sandbox_provider != "modal" || length(trimspace(var.modal_api_secret)) > 0
    error_message = "modal_api_secret must be set when sandbox_provider is 'modal'."
  }
}

variable "nextauth_secret" {
  description = "NextAuth.js secret (generate with: openssl rand -base64 32)"
  type        = string
  sensitive   = true
}

# =============================================================================
# Configuration
# =============================================================================

variable "web_platform" {
  description = "Platform for the web app deployment: 'vercel' or 'cloudflare' (OpenNext)"
  type        = string
  default     = "vercel"

  validation {
    condition     = contains(["vercel", "cloudflare"], var.web_platform)
    error_message = "web_platform must be 'vercel' or 'cloudflare'."
  }
}

variable "deployment_name" {
  description = "Unique slug (not a URL). Used in Cloudflare worker names, D1 database name, and (by default) the Vercel web project open-inspect-{deployment_name}. Override the Vercel slug with vercel_web_project_name if the web app was created separately. Do not paste .vercel.app or full hostnames."
  type        = string

  validation {
    condition = (
      can(regex("^[a-z0-9]+(-[a-z0-9]+)*$", var.deployment_name))
      && length(var.deployment_name) >= 1
      && length(var.deployment_name) <= 39
    )
    error_message = "deployment_name must be a short slug: lowercase letters, digits, hyphens only (no dots). Max length 39 so the default Vercel project name open-inspect-<name> stays within 52 characters. Example: 'myteam' — not 'myproject.vercel.app'."
  }
}

variable "vercel_web_project_name" {
  description = "Vercel project slug (Settings → General), not the browser URL. Example: 'background-agents-web'. Team-scoped production URLs are often projectname-teamsuffix.vercel.app — set vercel_web_production_hostname when that differs from {slug}.vercel.app."
  type        = string
  default     = ""

  validation {
    condition = (
      var.vercel_web_project_name == ""
      || (
        can(regex("^[a-z0-9]+(-[a-z0-9]+)*$", var.vercel_web_project_name))
        && length(var.vercel_web_project_name) >= 1
        && length(var.vercel_web_project_name) <= 100
      )
    )
    error_message = "vercel_web_project_name must be empty or a Vercel project slug: lowercase letters, digits, hyphens only, max 100 characters."
  }
}

variable "vercel_web_production_hostname" {
  description = "Public production hostname for the web app when it is not {vercel_web_project_name}.vercel.app (e.g. Vercel team URLs: background-agents-web-roan.vercel.app). No https://. Leave empty to derive https://{project-slug}.vercel.app from the project name."
  type        = string
  default     = ""

  validation {
    condition = (
      trimspace(var.vercel_web_production_hostname) == ""
      || (
        !strcontains(var.vercel_web_production_hostname, "://")
        && can(regex("^[a-z0-9][a-z0-9.-]*\\.vercel\\.app$", trimspace(var.vercel_web_production_hostname)))
      )
    )
    error_message = "vercel_web_production_hostname must be empty or a hostname like my-app-teamslug.vercel.app (no https://, lowercase)."
  }
}

variable "vercel_web_git_repository" {
  description = "Git repo linked to the Vercel web project for deploy-on-push (production branch + previews). Null = no Git link (CLI/CI-only)."
  type = object({
    type                = string
    repo                = string # owner/name, e.g. acme/my-app
    production_branch   = optional(string, "main")
  })
  default = null

  validation {
    condition = (
      var.vercel_web_git_repository == null
      || contains(["github", "gitlab", "bitbucket"], var.vercel_web_git_repository.type)
    )
    error_message = "vercel_web_git_repository.type must be github, gitlab, or bitbucket."
  }
}

variable "enable_durable_object_bindings" {
  description = "Enable DO bindings. For initial deployment: set to false (applies migrations), then set to true (adds bindings)."
  type        = bool
  default     = true
}

variable "control_plane_migration_tag" {
  description = "Current migration tag for control plane DO migrations"
  type        = string
  default     = "v1"
}

variable "control_plane_migration_old_tag" {
  description = "Previous migration tag for control plane DO migrations (null for fresh deployments)"
  type        = string
  default     = null
}

variable "control_plane_new_sqlite_classes" {
  description = "DO classes new in this control plane migration step (empty means treat all configured classes as new)"
  type        = list(string)
  default     = []
}

variable "enable_service_bindings" {
  description = "Enable service bindings. Set false for initial deployment if target workers don't exist yet."
  type        = bool
  default     = true
}

variable "project_root" {
  description = "Root path to the repository from this directory (no trailing slash preferred; trailing slashes are stripped)."
  type        = string
  default     = "../../.."
}

# =============================================================================
# Access Control
# =============================================================================

variable "allowed_users" {
  description = "Comma-separated list of GitHub usernames allowed to sign in (empty = allow all)"
  type        = string
  default     = ""
}

variable "allowed_email_domains" {
  description = "Comma-separated list of email domains allowed to sign in (e.g., 'example.com,corp.io'). Empty = allow all domains."
  type        = string
  default     = ""
}
