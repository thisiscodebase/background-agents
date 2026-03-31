import { describe, it, expect, vi } from "vitest";
import { SandboxProviderError } from "../provider";
import { VercelCompatApiError } from "../vercel-client";
import { VercelSandboxProvider } from "./vercel-provider";
import type { VercelCompatClient } from "../vercel-client";
import type {
  CreateSandboxRequest,
  CreateSandboxResponse,
  RestoreSandboxRequest,
  RestoreSandboxResponse,
  SnapshotSandboxRequest,
  SnapshotSandboxResponse,
} from "../client";

function createMockVercelClient(
  overrides: Partial<{
    createSandbox: (req: CreateSandboxRequest) => Promise<CreateSandboxResponse>;
    restoreSandbox: (req: RestoreSandboxRequest) => Promise<RestoreSandboxResponse>;
    snapshotSandbox: (req: SnapshotSandboxRequest) => Promise<SnapshotSandboxResponse>;
  }> = {}
): VercelCompatClient {
  return {
    createSandbox: vi.fn(
      async (): Promise<CreateSandboxResponse> => ({
        sandboxId: "sandbox-123",
        modalObjectId: "sandbox-123",
        status: "warming",
        createdAt: Date.now(),
      })
    ),
    restoreSandbox: vi.fn(
      async (): Promise<RestoreSandboxResponse> => ({
        success: true,
        sandboxId: "sandbox-123",
        modalObjectId: "sandbox-123",
      })
    ),
    snapshotSandbox: vi.fn(
      async (): Promise<SnapshotSandboxResponse> => ({
        success: true,
        imageId: "persist:sandbox-123",
      })
    ),
    ...overrides,
  } as unknown as VercelCompatClient;
}

const testConfig = {
  sessionId: "test-session",
  sandboxId: "sandbox-123",
  repoOwner: "test-owner",
  repoName: "test-repo",
  controlPlaneUrl: "https://control-plane.test",
  sandboxAuthToken: "test-token",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
};

describe("VercelSandboxProvider", () => {
  it("reports provider capabilities", () => {
    const provider = new VercelSandboxProvider(createMockVercelClient());
    expect(provider.name).toBe("vercel");
    expect(provider.capabilities.supportsSnapshots).toBe(true);
    expect(provider.capabilities.supportsRestore).toBe(true);
    expect(provider.capabilities.supportsWarm).toBe(true);
  });

  it("maps createSandbox response shape", async () => {
    const provider = new VercelSandboxProvider(createMockVercelClient());
    const result = await provider.createSandbox(testConfig);
    expect(result.sandboxId).toBe("sandbox-123");
    expect(result.providerObjectId).toBe("sandbox-123");
  });

  it("classifies 503 as transient", async () => {
    const provider = new VercelSandboxProvider(
      createMockVercelClient({
        createSandbox: vi.fn(async () => {
          throw new VercelCompatApiError("service unavailable", 503);
        }),
      })
    );

    await expect(provider.createSandbox(testConfig)).rejects.toThrow(SandboxProviderError);
    try {
      await provider.createSandbox(testConfig);
    } catch (error) {
      expect((error as SandboxProviderError).errorType).toBe("transient");
    }
  });

  it("classifies 401 as permanent", async () => {
    const provider = new VercelSandboxProvider(
      createMockVercelClient({
        createSandbox: vi.fn(async () => {
          throw new VercelCompatApiError("unauthorized", 401);
        }),
      })
    );

    await expect(provider.createSandbox(testConfig)).rejects.toThrow(SandboxProviderError);
    try {
      await provider.createSandbox(testConfig);
    } catch (error) {
      expect((error as SandboxProviderError).errorType).toBe("permanent");
    }
  });
});
