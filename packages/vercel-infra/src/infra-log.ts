/**
 * One JSON line per log entry for Vercel Runtime Logs (filterable, grep-friendly).
 */
export function infraLog(record: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      service: "vercel-infra",
      ts: Date.now(),
      ...record,
    })
  );
}

export function isVerboseShellLogging(): boolean {
  return process.env.OPENINSPECT_VERCEL_INFRA_VERBOSE === "1";
}

/** Log stdout/stderr after each sandbox shell (see README — may include secrets). */
export function isSandboxCmdOutputLogEnabled(): boolean {
  return process.env.OPENINSPECT_SANDBOX_CMD_LOG === "1";
}
