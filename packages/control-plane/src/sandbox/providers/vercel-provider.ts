/**
 * Vercel compatibility sandbox provider implementation.
 *
 * Wraps the Vercel compatibility client behind the SandboxProvider interface.
 */

import { VercelCompatApiError } from "../vercel-client";
import type { VercelCompatClient } from "../vercel-client";
import {
  DEFAULT_SANDBOX_TIMEOUT_SECONDS,
  SandboxProviderError,
  type SandboxProvider,
  type SandboxProviderCapabilities,
  type CreateSandboxConfig,
  type CreateSandboxResult,
  type DiagnosticsConfig,
  type DiagnosticsResult,
  type RestoreConfig,
  type RestoreResult,
  type SnapshotConfig,
  type SnapshotResult,
} from "../provider";

export class VercelSandboxProvider implements SandboxProvider {
  readonly name = "vercel";

  readonly capabilities: SandboxProviderCapabilities = {
    supportsSnapshots: true,
    supportsRestore: true,
    supportsWarm: true,
  };

  constructor(private readonly client: VercelCompatClient) {}

  async createSandbox(config: CreateSandboxConfig): Promise<CreateSandboxResult> {
    try {
      const result = await this.client.createSandbox(
        {
          sessionId: config.sessionId,
          sandboxId: config.sandboxId,
          repoOwner: config.repoOwner,
          repoName: config.repoName,
          controlPlaneUrl: config.controlPlaneUrl,
          sandboxAuthToken: config.sandboxAuthToken,
          opencodeSessionId: config.opencodeSessionId,
          provider: config.provider,
          model: config.model,
          userEnvVars: config.userEnvVars,
          repoImageId: config.repoImageId,
          repoImageSha: config.repoImageSha,
          timeoutSeconds: config.timeoutSeconds,
          branch: config.branch,
          codeServerEnabled: config.codeServerEnabled,
        },
        config.correlation
      );

      return {
        sandboxId: result.sandboxId,
        providerObjectId: result.modalObjectId,
        status: result.status,
        createdAt: result.createdAt,
        codeServerUrl: result.codeServerUrl,
        codeServerPassword: result.codeServerPassword,
      };
    } catch (error) {
      throw this.classifyError("Failed to create sandbox", error);
    }
  }

  async restoreFromSnapshot(config: RestoreConfig): Promise<RestoreResult> {
    try {
      const result = await this.client.restoreSandbox(
        {
          snapshotImageId: config.snapshotImageId,
          sessionId: config.sessionId,
          sandboxId: config.sandboxId,
          sandboxAuthToken: config.sandboxAuthToken,
          controlPlaneUrl: config.controlPlaneUrl,
          repoOwner: config.repoOwner,
          repoName: config.repoName,
          provider: config.provider,
          model: config.model,
          userEnvVars: config.userEnvVars,
          timeoutSeconds: config.timeoutSeconds ?? DEFAULT_SANDBOX_TIMEOUT_SECONDS,
          branch: config.branch,
          codeServerEnabled: config.codeServerEnabled,
        },
        config.correlation
      );

      if (result.success) {
        return {
          success: true,
          sandboxId: result.sandboxId,
          providerObjectId: result.modalObjectId,
          codeServerUrl: result.codeServerUrl,
          codeServerPassword: result.codeServerPassword,
        };
      }

      return {
        success: false,
        error: result.error || "Unknown restore error",
      };
    } catch (error) {
      if (error instanceof VercelCompatApiError) {
        throw this.classifyErrorWithStatus(
          `Restore failed with HTTP ${error.status}`,
          error.status
        );
      }
      if (error instanceof SandboxProviderError) {
        throw error;
      }
      throw this.classifyError("Failed to restore sandbox from snapshot", error);
    }
  }

  async takeSnapshot(config: SnapshotConfig): Promise<SnapshotResult> {
    try {
      const result = await this.client.snapshotSandbox(
        {
          providerObjectId: config.providerObjectId,
          sessionId: config.sessionId,
          reason: config.reason,
        },
        config.correlation
      );

      if (result.success && result.imageId) {
        return {
          success: true,
          imageId: result.imageId,
        };
      }

      return {
        success: false,
        error: result.error || "Unknown snapshot error",
      };
    } catch (error) {
      if (error instanceof VercelCompatApiError) {
        throw this.classifyErrorWithStatus(
          `Snapshot failed with HTTP ${error.status}`,
          error.status
        );
      }
      if (error instanceof SandboxProviderError) {
        throw error;
      }
      throw this.classifyError("Failed to take snapshot", error);
    }
  }

  async collectDiagnostics(config: DiagnosticsConfig): Promise<DiagnosticsResult> {
    try {
      const result = await this.client.debugSandbox(
        {
          sandboxId: config.providerObjectId,
          reason: config.reason,
          tailLines: 200,
        },
        config.correlation
      );
      return {
        success: true,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      if (error instanceof VercelCompatApiError) {
        return {
          success: false,
          error: `Diagnostics endpoint failed: HTTP ${error.status}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private classifyErrorWithStatus(message: string, status: number): SandboxProviderError {
    if (status === 502 || status === 503 || status === 504) {
      return new SandboxProviderError(message, "transient");
    }
    return new SandboxProviderError(message, "permanent");
  }

  private classifyError(message: string, error: unknown): SandboxProviderError {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("etimedout") ||
        errorMessage.includes("econnreset") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("network") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("502") ||
        errorMessage.includes("503") ||
        errorMessage.includes("504") ||
        errorMessage.includes("bad gateway") ||
        errorMessage.includes("service unavailable") ||
        errorMessage.includes("gateway timeout")
      ) {
        return new SandboxProviderError(`${message}: ${error.message}`, "transient", error);
      }
    }
    return new SandboxProviderError(
      `${message}: ${error instanceof Error ? error.message : String(error)}`,
      "permanent",
      error instanceof Error ? error : undefined
    );
  }
}

export function createVercelProvider(client: VercelCompatClient): VercelSandboxProvider {
  return new VercelSandboxProvider(client);
}
