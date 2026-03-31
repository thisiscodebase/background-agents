locals {
  # Strip trailing slash so "${local.repo_root}/packages/..." never becomes "...//packages"
  # (double slashes break Cloudflare worker_version modules identity during apply).
  repo_root   = trimsuffix(var.project_root, "/")
  name_suffix = var.deployment_name

  # Vercel web project slug: default open-inspect-{deployment_name}, or an existing project from tfvars.
  vercel_web_project_slug = trimspace(var.vercel_web_project_name) != "" ? trimspace(var.vercel_web_project_name) : "open-inspect-${local.name_suffix}"

  # Team-scoped Vercel URLs often use projectname-teamsuffix.vercel.app; optional override for NEXTAUTH_URL / WEB_APP_URL.
  vercel_web_production_host = trimspace(var.vercel_web_production_hostname) != "" ? trimspace(var.vercel_web_production_hostname) : "${local.vercel_web_project_slug}.vercel.app"

  # URLs for cross-service configuration
  control_plane_host = "open-inspect-control-plane-${local.name_suffix}.${var.cloudflare_worker_subdomain}.workers.dev"
  control_plane_url  = "https://${local.control_plane_host}"
  ws_url             = "wss://${local.control_plane_host}"

  # Web app URL depends on deployment platform
  web_app_url = var.web_platform == "cloudflare" ? (
    "https://open-inspect-web-${local.name_suffix}.${var.cloudflare_worker_subdomain}.workers.dev"
    ) : (
    "https://${local.vercel_web_production_host}"
  )

  # Worker script paths (deterministic output locations)
  control_plane_script_path = "${local.repo_root}/packages/control-plane/dist/index.js"
  slack_bot_script_path     = "${local.repo_root}/packages/slack-bot/dist/index.js"
  linear_bot_script_path    = "${local.repo_root}/packages/linear-bot/dist/index.js"
  github_bot_script_path    = "${local.repo_root}/packages/github-bot/dist/index.js"

  # Hash of each esbuild output. Used as null_resource triggers instead of timestamp():
  # timestamp() forces a rebuild every apply and can desync cloudflare_worker_version's
  # planned module SHA from the file on disk (provider "inconsistent final plan").
  worker_bundle_triggers = {
    control_plane = fileexists(local.control_plane_script_path) ? filesha256(local.control_plane_script_path) : "missing"
    slack_bot     = fileexists(local.slack_bot_script_path) ? filesha256(local.slack_bot_script_path) : "missing"
    linear_bot    = fileexists(local.linear_bot_script_path) ? filesha256(local.linear_bot_script_path) : "missing"
    github_bot    = fileexists(local.github_bot_script_path) ? filesha256(local.github_bot_script_path) : "missing"
  }
}
