import { Sandbox } from "@vercel/sandbox";
import { infraLog, isSandboxCmdOutputLogEnabled, isVerboseShellLogging } from "./infra-log";

const MAX_STREAM_CHARS = 12_000;

function normalizeName(input: string): string {
  const stripped = input.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const trimmed = stripped.replace(/^-+|-+$/g, "");
  const name = trimmed.length > 0 ? trimmed : "open-inspect";
  return name.length > 56 ? name.slice(0, 56) : name;
}

export function buildSessionSandboxName(sessionId: string, preferredId?: string | null): string {
  if (preferredId && preferredId.trim().length > 0) {
    return normalizeName(preferredId);
  }
  return normalizeName(`oi-session-${sessionId}`);
}

export function buildRepoImageSandboxName(
  repoOwner: string,
  repoName: string,
  buildId: string
): string {
  return normalizeName(`oi-image-${repoOwner}-${repoName}-${buildId}`);
}

export async function getOrCreatePersistentSandbox(name: string): Promise<any> {
  try {
    const sandbox = await (Sandbox as any).get({ name });
    infraLog({
      event: "sandbox_resumed",
      sandbox_name: name,
      note: "Vercel GET /sandboxes/:name succeeded — persistent sandbox already existed",
    });
    return sandbox;
  } catch (getErr) {
    /** Expected on first use: Vercel API returns 404, SDK throws — we create next. */
    const detail =
      getErr instanceof Error ? getErr.message : typeof getErr === "string" ? getErr : "unknown";
    infraLog({
      event: "sandbox_get_miss",
      sandbox_name: name,
      note: "GET failed (often 404) — creating new persistent sandbox; this is normal for a new name",
      ...(isVerboseShellLogging() ? { get_error: detail.slice(0, 300) } : {}),
    });
    const sandbox = await (Sandbox as any).create({ name, persistent: true });
    infraLog({ event: "sandbox_created", sandbox_name: name });
    return sandbox;
  }
}

export async function getExistingPersistentSandbox(name: string): Promise<any> {
  const sandbox = await (Sandbox as any).get({ name });
  infraLog({
    event: "sandbox_resumed",
    sandbox_name: name,
    note: "Fetched existing persistent sandbox for diagnostics",
  });
  return sandbox;
}

export async function resumeOrCreateFromSnapshot(
  snapshotRef: string,
  fallbackName: string
): Promise<any> {
  const snapshotName = snapshotRef.replace(/^persist:/, "").trim();
  if (snapshotName.length > 0) {
    return getOrCreatePersistentSandbox(snapshotName);
  }
  return getOrCreatePersistentSandbox(fallbackName);
}

function truncateForLog(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}… [truncated ${t.length - max} chars]`;
}

async function readCommandStreams(finished: {
  stdout?: () => Promise<string>;
  stderr?: () => Promise<string>;
}): Promise<{ stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  try {
    if (typeof finished.stdout === "function") {
      stdout = await finished.stdout();
    }
  } catch {
    // ignore
  }
  try {
    if (typeof finished.stderr === "function") {
      stderr = await finished.stderr();
    }
  } catch {
    // ignore
  }
  return { stdout, stderr };
}

/**
 * Run a bash -lc script in the sandbox.
 * @param phase — short label for logs (e.g. sync_repo, bootstrap_cmd).
 */
export async function runShellCommand(
  sandbox: any,
  command: string,
  phase = "shell",
  cmdPreviewOverride?: string
): Promise<void> {
  const logOutput = isSandboxCmdOutputLogEnabled();
  const cmdPreview = cmdPreviewOverride ?? command;
  if (isVerboseShellLogging() || logOutput) {
    infraLog({
      event: "shell_command_start",
      phase,
      cmd_bytes: command.length,
      cmd_preview: truncateForLog(cmdPreview, 400),
    });
  }
  const finished = await sandbox.runCommand("bash", ["-lc", command]);
  const exitCode = finished.exitCode ?? -1;

  if (logOutput) {
    const { stdout, stderr } = await readCommandStreams(finished);
    infraLog({
      event: "shell_command_output",
      phase,
      exit_code: exitCode,
      stdout: truncateForLog(stdout, MAX_STREAM_CHARS),
      stderr: truncateForLog(stderr, MAX_STREAM_CHARS),
    });
  } else if (isVerboseShellLogging()) {
    infraLog({ event: "shell_command_done", phase, exit_code: exitCode });
  }

  if (exitCode !== 0) {
    let stderr = "";
    try {
      stderr = typeof finished.stderr === "function" ? await finished.stderr() : "";
    } catch {
      // ignore secondary failures
    }
    const tail = stderr.trim().slice(-2000);
    throw new Error(`shell command failed (exit ${exitCode})${tail ? `: ${tail}` : ""}`);
  }
}

export async function runShellCommandWithOutput(
  sandbox: any,
  command: string,
  phase = "diagnostics"
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  infraLog({
    event: "shell_command_start",
    phase,
    cmd_bytes: command.length,
    cmd_preview: truncateForLog(command, 400),
  });
  const finished = await sandbox.runCommand("bash", ["-lc", command]);
  const exitCode = finished.exitCode ?? -1;
  const { stdout, stderr } = await readCommandStreams(finished);
  infraLog({
    event: "shell_command_output",
    phase,
    exit_code: exitCode,
    stdout: truncateForLog(stdout, MAX_STREAM_CHARS),
    stderr: truncateForLog(stderr, MAX_STREAM_CHARS),
  });
  return { exitCode, stdout, stderr };
}
