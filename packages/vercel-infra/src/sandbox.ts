import { Sandbox } from "@vercel/sandbox";

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
    return await (Sandbox as any).get({ name });
  } catch {
    return (Sandbox as any).create({ name, persistent: true });
  }
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

export async function runShellCommand(sandbox: any, command: string): Promise<void> {
  await sandbox.runCommand("bash", ["-lc", command]);
}
