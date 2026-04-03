import { generateInternalToken } from "@open-inspect/shared";
import { Hono } from "hono";
import { requireInternalAuth } from "./auth";
import { resolveRuntimeEnv } from "./runtime-env";
import { infraLog } from "./infra-log";
import {
  buildRepoImageSandboxName,
  buildSessionSandboxName,
  getExistingPersistentSandbox,
  getOrCreatePersistentSandbox,
  resumeOrCreateFromSnapshot,
  runShellCommand,
  runShellCommandWithOutput,
} from "./sandbox";
import type {
  ApiEnvelope,
  BuildRepoImageRequest,
  CreateSandboxRequest,
  DebugSandboxRequest,
  DeleteProviderImageRequest,
  Env,
  RestoreSandboxRequest,
  SnapshotSandboxRequest,
} from "./types";

const app = new Hono<{ Bindings: Env }>();
const DEFAULT_BRIDGE_BOOT_CMD = [
  "set -euo pipefail",
  "if command -v python3 >/dev/null 2>&1; then PYTHON_BIN=python3; elif command -v python >/dev/null 2>&1; then PYTHON_BIN=python; else echo 'python interpreter not found (need python3 or python)' >&2; exit 1; fi",
  "if ! \"$PYTHON_BIN\" -c 'import sandbox_runtime' >/dev/null 2>&1; then",
  "  if [ -d packages/sandbox-runtime ]; then",
  '    "$PYTHON_BIN" -m pip install -q -e packages/sandbox-runtime',
  '  elif [ -n "${OPENINSPECT_SANDBOX_RUNTIME_PIP_SPEC:-}" ]; then',
  '    "$PYTHON_BIN" -m pip install -q "$OPENINSPECT_SANDBOX_RUNTIME_PIP_SPEC"',
  "  else",
  '    echo "sandbox_runtime module missing. Expected packages/sandbox-runtime in cloned repo, or set OPENINSPECT_SANDBOX_RUNTIME_PIP_SPEC (example: git+https://...#subdirectory=packages/sandbox-runtime)." >&2',
  "    exit 1",
  "  fi",
  "fi",
  'exec "$PYTHON_BIN" -m sandbox_runtime.entrypoint',
].join("; ");

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sanitizeEnvVarName(name: string): string | null {
  return /^[A-Z_][A-Z0-9_]*$/.test(name) ? name : null;
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function isRestoreRequest(
  request: CreateSandboxRequest | RestoreSandboxRequest
): request is RestoreSandboxRequest {
  return "session_config" in request;
}

async function syncRepository(
  sandbox: any,
  request: CreateSandboxRequest | RestoreSandboxRequest,
  env: Env
): Promise<void> {
  const repoOwner = isRestoreRequest(request)
    ? request.session_config?.repo_owner
    : request.repo_owner;
  const repoName = isRestoreRequest(request)
    ? request.session_config?.repo_name
    : request.repo_name;
  const branch = isRestoreRequest(request) ? request.session_config?.branch : request.branch;

  if (!repoOwner || !repoName) {
    return;
  }

  const token = env.OPENINSPECT_GITHUB_TOKEN;
  const cloneUrl = token
    ? `https://x-access-token:${token}@github.com/${repoOwner}/${repoName}.git`
    : `https://github.com/${repoOwner}/${repoName}.git`;
  const redactedCloneUrl = token
    ? `https://x-access-token:***@github.com/${repoOwner}/${repoName}.git`
    : cloneUrl;
  const branchName = branch || "main";
  const repoDir = `/vercel/sandbox/workspaces/${repoName}`;
  const syncCommand = [
    "set -euo pipefail",
    "mkdir -p /vercel/sandbox/workspaces",
    `if [ ! -d ${shellEscape(repoDir)} ]; then git clone ${shellEscape(cloneUrl)} ${shellEscape(repoDir)}; fi`,
    `cd ${shellEscape(repoDir)}`,
    "git fetch --all --prune",
    `git checkout ${shellEscape(branchName)} || true`,
    "git pull --ff-only || true",
  ].join(" && ");
  const syncCommandPreview = [
    "set -euo pipefail",
    "mkdir -p /vercel/sandbox/workspaces",
    `if [ ! -d ${shellEscape(repoDir)} ]; then git clone ${shellEscape(redactedCloneUrl)} ${shellEscape(repoDir)}; fi`,
    `cd ${shellEscape(repoDir)}`,
    "git fetch --all --prune",
    `git checkout ${shellEscape(branchName)} || true`,
    "git pull --ff-only || true",
  ].join(" && ");

  await runShellCommand(sandbox, syncCommand, "sync_repo", syncCommandPreview);
}

async function bootstrapRuntime(
  sandbox: any,
  request: CreateSandboxRequest | RestoreSandboxRequest,
  env: Env
): Promise<void> {
  const sessionId = isRestoreRequest(request)
    ? request.session_config?.session_id
    : request.session_id;
  const repoOwner = isRestoreRequest(request)
    ? request.session_config?.repo_owner
    : request.repo_owner;
  const repoName = isRestoreRequest(request)
    ? request.session_config?.repo_name
    : request.repo_name;
  const branch = isRestoreRequest(request) ? request.session_config?.branch : request.branch;
  const provider = isRestoreRequest(request) ? request.session_config?.provider : request.provider;
  const model = isRestoreRequest(request) ? request.session_config?.model : request.model;
  const repoDir = repoName ? `/vercel/sandbox/workspaces/${repoName}` : "/vercel/sandbox";

  const exports: string[] = [];
  const setEnv = (key: string, value: string | undefined | null) => {
    if (!value) return;
    const safeKey = sanitizeEnvVarName(key);
    if (!safeKey) return;
    exports.push(`export ${safeKey}=${shellEscape(value)}`);
  };

  setEnv("CONTROL_PLANE_URL", request.control_plane_url);
  setEnv("SANDBOX_AUTH_TOKEN", request.sandbox_auth_token);
  if ("sandbox_id" in request) {
    setEnv("SANDBOX_ID", request.sandbox_id ?? undefined);
  }
  setEnv("SESSION_ID", sessionId);
  setEnv("REPO_OWNER", repoOwner);
  setEnv("REPO_NAME", repoName);
  setEnv("BRANCH", branch ?? undefined);
  setEnv("PROVIDER", provider ?? undefined);
  setEnv("MODEL", model ?? undefined);
  if (sessionId) {
    const sessionConfig = {
      session_id: sessionId,
      repo_owner: repoOwner ?? "",
      repo_name: repoName ?? "",
      branch: branch ?? "main",
      provider: provider ?? "anthropic",
      model: model ?? "claude-sonnet-4-6",
    };
    setEnv("SESSION_CONFIG", JSON.stringify(sessionConfig));
  }

  const userEnvVars = request.user_env_vars ?? undefined;
  if (userEnvVars) {
    for (const [key, value] of Object.entries(userEnvVars)) {
      setEnv(key, value);
    }
  }

  if (env.OPENINSPECT_BOOTSTRAP_CMD) {
    await runShellCommand(
      sandbox,
      [
        "set -euo pipefail",
        ...exports,
        `cd ${shellEscape(repoDir)}`,
        env.OPENINSPECT_BOOTSTRAP_CMD,
      ].join(" && "),
      "bootstrap_cmd"
    );
  }

  const bridgeBootCmd = env.OPENINSPECT_BRIDGE_BOOT_CMD || DEFAULT_BRIDGE_BOOT_CMD;
  if (!env.OPENINSPECT_BRIDGE_BOOT_CMD) {
    infraLog({
      event: "bridge_boot_cmd_defaulted",
      default_cmd: DEFAULT_BRIDGE_BOOT_CMD,
      session_id: sessionId,
      repo: repoName,
    });
  }
  if (bridgeBootCmd) {
    await runShellCommand(
      sandbox,
      [
        ...exports,
        `cd ${shellEscape(repoDir)}`,
        `nohup bash -lc ${shellEscape(bridgeBootCmd)} > /tmp/openinspect-bridge.log 2>&1 &`,
      ].join(" && "),
      "bridge_boot"
    );

    const verifyResult = await runShellCommandWithOutput(
      sandbox,
      [
        "set +e",
        "sleep 2",
        "echo '=== bridge process check ==='",
        "if ps aux | grep -E 'sandbox_runtime\\.entrypoint|sandbox_runtime\\.bridge|opencode serve' | grep -v grep >/dev/null; then echo 'bridge_alive=1'; else echo 'bridge_alive=0'; fi",
        "echo '=== bridge log tail ==='",
        "if [ -f /tmp/openinspect-bridge.log ]; then tail -n 120 /tmp/openinspect-bridge.log; else echo 'bridge log missing: /tmp/openinspect-bridge.log'; fi",
      ].join(" && "),
      "bridge_boot_verify"
    );

    if (!verifyResult.stdout.includes("bridge_alive=1")) {
      throw new Error(
        `bridge failed to stay running after boot; diagnostics:\n${verifyResult.stdout}\n${verifyResult.stderr}`.trim()
      );
    }
  }
}

function formatSandboxRouteError(route: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${route}: ${message}`;
}

function buildDiagnosticsCommand(tailLines: number): string {
  const lines = Number.isFinite(tailLines)
    ? Math.min(Math.max(Math.trunc(tailLines), 20), 1000)
    : 200;
  return [
    "set +e",
    "echo '=== diagnostics: bridge log tail ==='",
    `if [ -f /tmp/openinspect-bridge.log ]; then tail -n ${lines} /tmp/openinspect-bridge.log; else echo 'bridge log missing: /tmp/openinspect-bridge.log'; fi`,
    "echo '=== diagnostics: bridge/process table ==='",
    "ps aux | grep -E 'openinspect|opencode|bridge|code-server' | grep -v grep || echo 'no matching processes'",
  ].join(" && ");
}

async function callBuildCompleteCallback(
  callbackUrl: string,
  buildId: string,
  providerImageId: string,
  internalSecret: string
): Promise<void> {
  if (!internalSecret) {
    throw new Error("INTERNAL_CALLBACK_SECRET is not configured");
  }
  const token = await generateInternalToken(internalSecret);
  const body = JSON.stringify({
    build_id: buildId,
    provider_image_id: providerImageId,
    base_sha: "",
    build_duration_seconds: 0,
  });
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Build-complete callback failed: HTTP ${response.status}${text ? ` — ${text.slice(0, 500)}` : ""}`
    );
  }
}

function buildFailedCallbackUrl(completeCallbackUrl: string): string {
  return completeCallbackUrl.replace(/\/build-complete\/?$/, "/build-failed");
}

/** Best-effort notify control plane when complete callback fails (e.g. wrong secret). */
async function callBuildFailedCallback(
  completeCallbackUrl: string,
  buildId: string,
  internalSecret: string,
  detail: string
): Promise<void> {
  if (!internalSecret) return;
  const token = await generateInternalToken(internalSecret);
  const url = buildFailedCallbackUrl(completeCallbackUrl);
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      build_id: buildId,
      error: detail.length > 2000 ? `${detail.slice(0, 2000)}…` : detail,
    }),
  });
}

app.get("/api-health", (c) => {
  const response: ApiEnvelope<{ status: string; service: string }> = {
    success: true,
    data: { status: "healthy", service: "vercel-infra" },
  };
  return c.json(response);
});

app.get("/api-snapshot", async (c) => {
  if (!(await requireInternalAuth(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  return c.json({ success: true, data: null });
});

app.post("/api-create-sandbox", async (c) => {
  if (!(await requireInternalAuth(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const body = await parseJsonBody<CreateSandboxRequest>(c.req.raw);
  if (!body?.session_id || !body.repo_owner || !body.repo_name) {
    return c.json(
      { success: false, error: "session_id, repo_owner, and repo_name are required" },
      400
    );
  }

  const started = Date.now();
  try {
    const persistentName = buildSessionSandboxName(body.session_id);
    const responseSandboxId = body.sandbox_id || persistentName;
    infraLog({
      event: "api_create_sandbox_start",
      session_id: body.session_id,
      persistent_sandbox_name: persistentName,
      response_sandbox_id: responseSandboxId,
      repo: `${body.repo_owner}/${body.repo_name}`,
    });
    const sandbox = await getOrCreatePersistentSandbox(persistentName);
    const env = resolveRuntimeEnv(c);
    infraLog({ event: "api_create_sandbox_sync_repo", persistent_sandbox_name: persistentName });
    await syncRepository(sandbox, body, env);
    infraLog({ event: "api_create_sandbox_bootstrap", persistent_sandbox_name: persistentName });
    await bootstrapRuntime(sandbox, { ...body, sandbox_id: responseSandboxId }, env);

    infraLog({
      event: "api_create_sandbox_ok",
      persistent_sandbox_name: persistentName,
      duration_ms: Date.now() - started,
    });
    return c.json({
      success: true,
      data: {
        sandbox_id: responseSandboxId,
        modal_object_id: persistentName,
        status: "warming",
        created_at: Date.now(),
      },
    });
  } catch (error) {
    const message = formatSandboxRouteError("api-create-sandbox", error);
    infraLog({
      event: "api_create_sandbox_error",
      duration_ms: Date.now() - started,
      error: message.slice(0, 500),
    });
    console.error(message, error);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/api-restore-sandbox", async (c) => {
  if (!(await requireInternalAuth(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const body = await parseJsonBody<RestoreSandboxRequest>(c.req.raw);
  if (!body?.sandbox_id || !body.session_config?.session_id) {
    return c.json(
      { success: false, error: "sandbox_id and session_config.session_id are required" },
      400
    );
  }

  try {
    const persistentName = buildSessionSandboxName(body.session_config.session_id);
    const sandbox = await resumeOrCreateFromSnapshot(body.snapshot_image_id ?? "", persistentName);
    const responseSandboxId = body.sandbox_id || persistentName;
    const env = resolveRuntimeEnv(c);
    await syncRepository(sandbox, body, env);
    await bootstrapRuntime(sandbox, { ...body, sandbox_id: responseSandboxId }, env);

    return c.json({
      success: true,
      data: {
        sandbox_id: responseSandboxId,
        modal_object_id: persistentName,
        status: "warming",
      },
    });
  } catch (error) {
    const message = formatSandboxRouteError("api-restore-sandbox", error);
    console.error(message, error);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/api-snapshot-sandbox", async (c) => {
  if (!(await requireInternalAuth(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const body = await parseJsonBody<SnapshotSandboxRequest>(c.req.raw);
  if (!body?.sandbox_id) {
    return c.json({ success: false, error: "sandbox_id is required" }, 400);
  }

  try {
    const sandbox = await getOrCreatePersistentSandbox(body.sandbox_id);
    if (typeof sandbox.stop === "function") {
      await sandbox.stop();
    }
  } catch {
    // Best-effort pause. Snapshot identity remains deterministic via sandbox name.
  }

  return c.json({
    success: true,
    data: {
      image_id: `persist:${body.sandbox_id}`,
      reason: body.reason ?? "manual",
    },
  });
});

app.post("/api-debug-sandbox", async (c) => {
  if (!(await requireInternalAuth(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const body = await parseJsonBody<DebugSandboxRequest>(c.req.raw);
  if (!body?.sandbox_id) {
    return c.json({ success: false, error: "sandbox_id is required" }, 400);
  }

  const started = Date.now();
  const tailLines = body.tail_lines ?? 200;
  try {
    infraLog({
      event: "api_debug_sandbox_start",
      sandbox_id: body.sandbox_id,
      reason: body.reason ?? "unspecified",
      tail_lines: tailLines,
    });
    const sandbox = await getExistingPersistentSandbox(body.sandbox_id);
    const result = await runShellCommandWithOutput(
      sandbox,
      buildDiagnosticsCommand(tailLines),
      "debug_sandbox"
    );
    infraLog({
      event: "api_debug_sandbox_ok",
      sandbox_id: body.sandbox_id,
      duration_ms: Date.now() - started,
      exit_code: result.exitCode,
    });
    return c.json({
      success: true,
      data: {
        sandbox_id: body.sandbox_id,
        exit_code: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      },
    });
  } catch (error) {
    const message = formatSandboxRouteError("api-debug-sandbox", error);
    infraLog({
      event: "api_debug_sandbox_error",
      sandbox_id: body.sandbox_id,
      duration_ms: Date.now() - started,
      error: message.slice(0, 500),
    });
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/api-warm-sandbox", async (c) => {
  if (!(await requireInternalAuth(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const body = await parseJsonBody<CreateSandboxRequest>(c.req.raw);
  if (!body?.repo_owner || !body.repo_name) {
    return c.json({ success: false, error: "repo_owner and repo_name are required" }, 400);
  }

  const sandboxName = buildSessionSandboxName(`warm-${body.repo_owner}-${body.repo_name}`);
  await getOrCreatePersistentSandbox(sandboxName);

  return c.json({
    success: true,
    data: { sandbox_id: sandboxName, status: "warming" },
  });
});

app.post("/api-build-repo-image", async (c) => {
  if (!(await requireInternalAuth(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const body = await parseJsonBody<BuildRepoImageRequest>(c.req.raw);
  if (!body?.repo_owner || !body.repo_name || !body.build_id || !body.callback_url) {
    return c.json(
      { success: false, error: "repo_owner, repo_name, build_id, and callback_url are required" },
      400
    );
  }

  const imageName = buildRepoImageSandboxName(body.repo_owner, body.repo_name, body.build_id);
  const sandbox = await getOrCreatePersistentSandbox(imageName);

  const createLikeBody: CreateSandboxRequest = {
    session_id: `repo-build-${body.build_id}`,
    sandbox_id: imageName,
    repo_owner: body.repo_owner,
    repo_name: body.repo_name,
    branch: body.default_branch || "main",
    control_plane_url: "",
    sandbox_auth_token: "",
    user_env_vars: body.user_env_vars,
  };
  const env = resolveRuntimeEnv(c);
  await syncRepository(sandbox, createLikeBody, env);
  await bootstrapRuntime(sandbox, createLikeBody, env);

  try {
    await callBuildCompleteCallback(
      body.callback_url,
      body.build_id,
      imageName,
      env.INTERNAL_CALLBACK_SECRET
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      await callBuildFailedCallback(
        body.callback_url,
        body.build_id,
        env.INTERNAL_CALLBACK_SECRET,
        `Image build finished but control plane was not notified: ${message}`
      );
    } catch {
      // ignore secondary callback failures
    }
    return c.json({ success: false, error: `Failed to call build callback: ${message}` }, 502);
  }

  return c.json({
    success: true,
    data: {
      build_id: body.build_id,
      status: "building",
    },
  });
});

app.post("/api-delete-provider-image", async (c) => {
  if (!(await requireInternalAuth(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const body = await parseJsonBody<DeleteProviderImageRequest>(c.req.raw);
  if (!body?.provider_image_id) {
    return c.json({ success: false, error: "provider_image_id is required" }, 400);
  }

  try {
    const sandbox = await getOrCreatePersistentSandbox(body.provider_image_id);
    if (typeof sandbox.delete === "function") {
      await sandbox.delete();
    } else if (typeof sandbox.stop === "function") {
      await sandbox.stop();
    }
  } catch {
    // best-effort cleanup
  }

  return c.json({
    success: true,
    data: {
      provider_image_id: body.provider_image_id,
      deleted: true,
    },
  });
});

export default app;
