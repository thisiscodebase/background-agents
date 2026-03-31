# Verify default Vercel URL pattern matches the provider module output. When the
# public URL is team-scoped (projectname-teamsuffix.vercel.app), set
# vercel_web_production_hostname instead — the module still reports https://{slug}.vercel.app.
check "vercel_url_matches" {
  assert {
    condition = (
      var.web_platform != "vercel" ||
      length(module.web_app) == 0 ||
      trimspace(var.vercel_web_production_hostname) != "" ||
      module.web_app[0].production_url == local.web_app_url
    )
    error_message = "Vercel module URL '${var.web_platform == "vercel" && length(module.web_app) > 0 ? module.web_app[0].production_url : "n/a"}' does not match local.web_app_url '${local.web_app_url}'. Set vercel_web_production_hostname to your real .vercel.app host (e.g. projectname-teamsuffix.vercel.app) or fix the project slug."
  }
}
