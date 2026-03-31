import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateInternalToken } from "@open-inspect/shared";
import app from "./index";

const sandboxMocks = vi.hoisted(() => {
  const sandboxInstance = {
    runCommand: vi.fn(async () => ({})),
    stop: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const sandboxGet = vi.fn(async (): Promise<any> => {
    throw new Error("not found");
  });
  const sandboxCreate = vi.fn(async (): Promise<any> => sandboxInstance);
  return { sandboxInstance, sandboxGet, sandboxCreate };
});

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: sandboxMocks.sandboxGet,
    create: sandboxMocks.sandboxCreate,
  },
}));

const env = {
  SANDBOX_API_SECRET: "test-secret",
  OPENINSPECT_GITHUB_TOKEN: "",
  OPENINSPECT_BOOTSTRAP_CMD: "echo bootstrap",
  OPENINSPECT_BRIDGE_BOOT_CMD: "echo bridge",
};

async function authHeader() {
  const token = await generateInternalToken(env.SANDBOX_API_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe("vercel-infra compatibility API", () => {
  beforeEach(() => {
    sandboxMocks.sandboxGet.mockReset();
    sandboxMocks.sandboxCreate.mockReset();
    sandboxMocks.sandboxGet.mockImplementation(async () => {
      throw new Error("not found");
    });
    sandboxMocks.sandboxCreate.mockImplementation(async () => sandboxMocks.sandboxInstance);
    sandboxMocks.sandboxInstance.runCommand.mockClear();
    sandboxMocks.sandboxInstance.stop.mockClear();
    sandboxMocks.sandboxInstance.delete.mockClear();
  });

  it("returns healthy status", async () => {
    const response = await app.request("http://localhost/api-health", {}, env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("rejects create sandbox without auth", async () => {
    const response = await app.request(
      "http://localhost/api-create-sandbox",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: "session-1",
          repo_owner: "acme",
          repo_name: "app",
        }),
      },
      env
    );
    expect(response.status).toBe(401);
  });

  it("creates or resumes sandbox with valid auth", async () => {
    const response = await app.request(
      "http://localhost/api-create-sandbox",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader()),
        },
        body: JSON.stringify({
          session_id: "session-1",
          sandbox_id: "sandbox-acme-app-1",
          repo_owner: "acme",
          repo_name: "app",
          branch: "main",
          control_plane_url: "https://control-plane.test",
          sandbox_auth_token: "auth-token",
          user_env_vars: { TEST_FLAG: "1" },
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data?: { sandbox_id: string; modal_object_id: string };
    };
    expect(body.success).toBe(true);
    expect(body.data?.sandbox_id).toBe("sandbox-acme-app-1");
    expect(body.data?.modal_object_id).toContain("oi-session-session-1");
    expect(sandboxMocks.sandboxCreate).toHaveBeenCalled();
    expect(sandboxMocks.sandboxInstance.runCommand).toHaveBeenCalled();
  });

  it("stops sandbox on snapshot call", async () => {
    sandboxMocks.sandboxGet.mockImplementation(async () => sandboxMocks.sandboxInstance);

    const response = await app.request(
      "http://localhost/api-snapshot-sandbox",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader()),
        },
        body: JSON.stringify({
          sandbox_id: "oi-session-session-1",
          session_id: "session-1",
          reason: "execution_complete",
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data?: { image_id: string };
    };
    expect(body.success).toBe(true);
    expect(body.data?.image_id).toBe("persist:oi-session-session-1");
    expect(sandboxMocks.sandboxInstance.stop).toHaveBeenCalled();
  });
});
