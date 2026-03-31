/**
 * Vercel compatibility sandbox API client.
 *
 * Talks to a Vercel-hosted compatibility service that preserves the
 * existing `/api-*` endpoint contracts used by the control-plane.
 */

import { generateInternalToken } from "@open-inspect/shared";
import { createLogger } from "../logger";
import type { CorrelationContext } from "../logger";
import type {
  BuildRepoImageRequest,
  BuildRepoImageResponse,
  CreateSandboxRequest,
  CreateSandboxResponse,
  DeleteProviderImageRequest,
  DeleteProviderImageResponse,
  RestoreSandboxRequest,
  RestoreSandboxResponse,
  SnapshotInfo,
  SnapshotSandboxRequest,
  SnapshotSandboxResponse,
  WarmSandboxRequest,
  WarmSandboxResponse,
} from "./client";

const log = createLogger("vercel-compat-client");

interface CompatApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class VercelCompatApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "VercelCompatApiError";
  }
}

export class VercelCompatClient {
  private readonly createSandboxUrl: string;
  private readonly warmSandboxUrl: string;
  private readonly healthUrl: string;
  private readonly snapshotUrl: string;
  private readonly snapshotSandboxUrl: string;
  private readonly restoreSandboxUrl: string;
  private readonly buildRepoImageUrl: string;
  private readonly deleteProviderImageUrl: string;

  constructor(
    private readonly secret: string,
    private readonly baseUrl: string
  ) {
    if (!secret) {
      throw new Error("VercelCompatClient requires SANDBOX_API_SECRET for authentication");
    }
    if (!baseUrl) {
      throw new Error("VercelCompatClient requires SANDBOX_API_BASE_URL");
    }

    const trimmedBaseUrl = baseUrl.replace(/\/$/, "");
    this.createSandboxUrl = `${trimmedBaseUrl}/api-create-sandbox`;
    this.warmSandboxUrl = `${trimmedBaseUrl}/api-warm-sandbox`;
    this.healthUrl = `${trimmedBaseUrl}/api-health`;
    this.snapshotUrl = `${trimmedBaseUrl}/api-snapshot`;
    this.snapshotSandboxUrl = `${trimmedBaseUrl}/api-snapshot-sandbox`;
    this.restoreSandboxUrl = `${trimmedBaseUrl}/api-restore-sandbox`;
    this.buildRepoImageUrl = `${trimmedBaseUrl}/api-build-repo-image`;
    this.deleteProviderImageUrl = `${trimmedBaseUrl}/api-delete-provider-image`;
  }

  private async getPostHeaders(correlation?: CorrelationContext): Promise<Record<string, string>> {
    const token = await generateInternalToken(this.secret);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (correlation?.trace_id) headers["x-trace-id"] = correlation.trace_id;
    if (correlation?.request_id) headers["x-request-id"] = correlation.request_id;
    if (correlation?.session_id) headers["x-session-id"] = correlation.session_id;
    if (correlation?.sandbox_id) headers["x-sandbox-id"] = correlation.sandbox_id;
    return headers;
  }

  private async getGetHeaders(correlation?: CorrelationContext): Promise<Record<string, string>> {
    const token = await generateInternalToken(this.secret);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (correlation?.trace_id) headers["x-trace-id"] = correlation.trace_id;
    if (correlation?.request_id) headers["x-request-id"] = correlation.request_id;
    if (correlation?.session_id) headers["x-session-id"] = correlation.session_id;
    if (correlation?.sandbox_id) headers["x-sandbox-id"] = correlation.sandbox_id;
    return headers;
  }

  async createSandbox(
    request: CreateSandboxRequest,
    correlation?: CorrelationContext
  ): Promise<CreateSandboxResponse> {
    const startTime = Date.now();
    let httpStatus: number | undefined;
    let outcome: "success" | "error" = "error";
    try {
      const response = await fetch(this.createSandboxUrl, {
        method: "POST",
        headers: await this.getPostHeaders(correlation),
        body: JSON.stringify({
          session_id: request.sessionId,
          sandbox_id: request.sandboxId || null,
          repo_owner: request.repoOwner,
          repo_name: request.repoName,
          control_plane_url: request.controlPlaneUrl,
          sandbox_auth_token: request.sandboxAuthToken,
          snapshot_id: request.snapshotId || null,
          opencode_session_id: request.opencodeSessionId || null,
          provider: request.provider || "anthropic",
          model: request.model || "claude-sonnet-4-6",
          user_env_vars: request.userEnvVars || null,
          repo_image_id: request.repoImageId || null,
          repo_image_sha: request.repoImageSha || null,
          timeout_seconds: request.timeoutSeconds || null,
          branch: request.branch || null,
          code_server_enabled: request.codeServerEnabled ?? false,
        }),
      });

      httpStatus = response.status;
      if (!response.ok) {
        throw new VercelCompatApiError(
          `Vercel compat API error: ${response.status} ${await response.text()}`,
          response.status
        );
      }

      const result = (await response.json()) as CompatApiResponse<{
        sandbox_id: string;
        modal_object_id?: string;
        status: string;
        created_at: number;
        code_server_url?: string;
        code_server_password?: string;
      }>;

      if (!result.success || !result.data) {
        throw new Error(result.error || "Unknown create sandbox error");
      }

      outcome = "success";
      return {
        sandboxId: result.data.sandbox_id,
        modalObjectId: result.data.modal_object_id,
        status: result.data.status,
        createdAt: result.data.created_at,
        codeServerUrl: result.data.code_server_url,
        codeServerPassword: result.data.code_server_password,
      };
    } finally {
      log.info("vercel_compat.request", {
        endpoint: "createSandbox",
        session_id: request.sessionId,
        sandbox_id: request.sandboxId,
        trace_id: correlation?.trace_id,
        request_id: correlation?.request_id,
        http_status: httpStatus,
        duration_ms: Date.now() - startTime,
        outcome,
      });
    }
  }

  async restoreSandbox(
    request: RestoreSandboxRequest,
    correlation?: CorrelationContext
  ): Promise<RestoreSandboxResponse> {
    const startTime = Date.now();
    let httpStatus: number | undefined;
    let outcome: "success" | "error" = "error";
    try {
      const response = await fetch(this.restoreSandboxUrl, {
        method: "POST",
        headers: await this.getPostHeaders(correlation),
        body: JSON.stringify({
          snapshot_image_id: request.snapshotImageId,
          session_config: {
            session_id: request.sessionId,
            repo_owner: request.repoOwner,
            repo_name: request.repoName,
            provider: request.provider,
            model: request.model,
            branch: request.branch || null,
          },
          sandbox_id: request.sandboxId,
          control_plane_url: request.controlPlaneUrl,
          sandbox_auth_token: request.sandboxAuthToken,
          user_env_vars: request.userEnvVars || null,
          timeout_seconds: request.timeoutSeconds || null,
          code_server_enabled: request.codeServerEnabled ?? false,
        }),
      });

      httpStatus = response.status;
      if (!response.ok) {
        throw new VercelCompatApiError(
          `Vercel compat API error: ${response.status} ${await response.text()}`,
          response.status
        );
      }

      const result = (await response.json()) as CompatApiResponse<{
        sandbox_id: string;
        modal_object_id?: string;
        code_server_url?: string;
        code_server_password?: string;
      }>;
      if (!result.success) {
        return { success: false, error: result.error || "Unknown restore error" };
      }

      outcome = "success";
      return {
        success: true,
        sandboxId: result.data?.sandbox_id,
        modalObjectId: result.data?.modal_object_id,
        codeServerUrl: result.data?.code_server_url,
        codeServerPassword: result.data?.code_server_password,
      };
    } finally {
      log.info("vercel_compat.request", {
        endpoint: "restoreSandbox",
        session_id: request.sessionId,
        sandbox_id: request.sandboxId,
        trace_id: correlation?.trace_id,
        request_id: correlation?.request_id,
        http_status: httpStatus,
        duration_ms: Date.now() - startTime,
        outcome,
      });
    }
  }

  async snapshotSandbox(
    request: SnapshotSandboxRequest,
    correlation?: CorrelationContext
  ): Promise<SnapshotSandboxResponse> {
    const startTime = Date.now();
    let httpStatus: number | undefined;
    let outcome: "success" | "error" = "error";
    try {
      const response = await fetch(this.snapshotSandboxUrl, {
        method: "POST",
        headers: await this.getPostHeaders(correlation),
        body: JSON.stringify({
          sandbox_id: request.providerObjectId,
          session_id: request.sessionId,
          reason: request.reason,
        }),
      });
      httpStatus = response.status;
      if (!response.ok) {
        throw new VercelCompatApiError(
          `Vercel compat API error: ${response.status} ${await response.text()}`,
          response.status
        );
      }

      const result = (await response.json()) as CompatApiResponse<{ image_id: string }>;
      if (!result.success) {
        return { success: false, error: result.error || "Unknown snapshot error" };
      }

      outcome = "success";
      return {
        success: true,
        imageId: result.data?.image_id,
      };
    } finally {
      log.info("vercel_compat.request", {
        endpoint: "snapshotSandbox",
        session_id: request.sessionId,
        sandbox_id: request.providerObjectId,
        trace_id: correlation?.trace_id,
        request_id: correlation?.request_id,
        http_status: httpStatus,
        duration_ms: Date.now() - startTime,
        outcome,
      });
    }
  }

  async warmSandbox(
    request: WarmSandboxRequest,
    correlation?: CorrelationContext
  ): Promise<WarmSandboxResponse> {
    const response = await fetch(this.warmSandboxUrl, {
      method: "POST",
      headers: await this.getPostHeaders(correlation),
      body: JSON.stringify({
        repo_owner: request.repoOwner,
        repo_name: request.repoName,
        control_plane_url: request.controlPlaneUrl || "",
      }),
    });
    if (!response.ok) {
      throw new VercelCompatApiError(
        `Vercel compat API error: ${response.status} ${await response.text()}`,
        response.status
      );
    }
    const result = (await response.json()) as CompatApiResponse<{
      sandbox_id: string;
      status: string;
    }>;
    if (!result.success || !result.data) {
      throw new Error(result.error || "Unknown warm sandbox error");
    }
    return {
      sandboxId: result.data.sandbox_id,
      status: result.data.status,
    };
  }

  async health(): Promise<{ status: string; service: string }> {
    const response = await fetch(this.healthUrl);
    if (!response.ok) {
      throw new VercelCompatApiError(
        `Vercel compat API error: ${response.status}`,
        response.status
      );
    }
    const result = (await response.json()) as CompatApiResponse<{
      status: string;
      service: string;
    }>;
    if (!result.success || !result.data) {
      throw new Error(result.error || "Unknown health check error");
    }
    return result.data;
  }

  async getLatestSnapshot(
    repoOwner: string,
    repoName: string,
    correlation?: CorrelationContext
  ): Promise<SnapshotInfo | null> {
    const response = await fetch(
      `${this.snapshotUrl}?repo_owner=${encodeURIComponent(repoOwner)}&repo_name=${encodeURIComponent(repoName)}`,
      { headers: await this.getGetHeaders(correlation) }
    );
    if (!response.ok) {
      return null;
    }
    const result = (await response.json()) as CompatApiResponse<SnapshotInfo>;
    if (!result.success) {
      return null;
    }
    return result.data || null;
  }

  async buildRepoImage(
    request: BuildRepoImageRequest,
    correlation?: CorrelationContext
  ): Promise<BuildRepoImageResponse> {
    const response = await fetch(this.buildRepoImageUrl, {
      method: "POST",
      headers: await this.getPostHeaders(correlation),
      body: JSON.stringify({
        repo_owner: request.repoOwner,
        repo_name: request.repoName,
        default_branch: request.defaultBranch || "main",
        build_id: request.buildId,
        callback_url: request.callbackUrl,
        user_env_vars: request.userEnvVars,
      }),
    });
    if (!response.ok) {
      throw new VercelCompatApiError(
        `Vercel compat API error: ${response.status} ${await response.text()}`,
        response.status
      );
    }
    const result = (await response.json()) as CompatApiResponse<{
      build_id: string;
      status: string;
    }>;
    if (!result.success || !result.data) {
      throw new Error(result.error || "Unknown build image error");
    }
    return { buildId: result.data.build_id, status: result.data.status };
  }

  async deleteProviderImage(
    request: DeleteProviderImageRequest,
    correlation?: CorrelationContext
  ): Promise<DeleteProviderImageResponse> {
    const response = await fetch(this.deleteProviderImageUrl, {
      method: "POST",
      headers: await this.getPostHeaders(correlation),
      body: JSON.stringify({
        provider_image_id: request.providerImageId,
      }),
    });
    if (!response.ok) {
      throw new VercelCompatApiError(
        `Vercel compat API error: ${response.status} ${await response.text()}`,
        response.status
      );
    }
    const result = (await response.json()) as CompatApiResponse<{
      provider_image_id: string;
      deleted: boolean;
    }>;
    if (!result.success || !result.data) {
      throw new Error(result.error || "Unknown delete provider image error");
    }
    return { providerImageId: result.data.provider_image_id, deleted: result.data.deleted };
  }
}

export function createVercelCompatClient(secret: string, baseUrl: string): VercelCompatClient {
  return new VercelCompatClient(secret, baseUrl);
}
