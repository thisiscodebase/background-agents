locals {
  # Strip trailing slash so "${local.repo_root}/packages/..." never becomes "...//packages"
  # (double slashes break Cloudflare worker_version modules identity during apply).
  repo_root   = trimsuffix(var.project_root, "/")
  name_suffix = var.deployment_name

  # URLs for cross-service configuration
  control_plane_host = "open-inspect-control-plane-${local.name_suffix}.${var.cloudflare_worker_subdomain}.workers.dev"
  control_plane_url  = "https://${local.control_plane_host}"
  ws_url             = "wss://${local.control_plane_host}"

  # Web app URL depends on deployment platform
  web_app_url = var.web_platform == "cloudflare" ? (
    "https://open-inspect-web-${local.name_suffix}.${var.cloudflare_worker_subdomain}.workers.dev"
    ) : (
    "https://open-inspect-${local.name_suffix}.vercel.app"
  )

  # Worker script paths (deterministic output locations)
  control_plane_script_path = "${local.repo_root}/packages/control-plane/dist/index.js"
  slack_bot_script_path     = "${local.repo_root}/packages/slack-bot/dist/index.js"
  linear_bot_script_path    = "${local.repo_root}/packages/linear-bot/dist/index.js"
  github_bot_script_path    = "${local.repo_root}/packages/github-bot/dist/index.js"
}
