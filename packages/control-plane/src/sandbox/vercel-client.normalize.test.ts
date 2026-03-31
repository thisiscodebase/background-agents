import { describe, expect, it } from "vitest";
import { normalizeSandboxApiBaseUrl } from "./vercel-client";

describe("normalizeSandboxApiBaseUrl", () => {
  it("prefixes https when scheme is missing", () => {
    expect(normalizeSandboxApiBaseUrl("background-agents-vercel-infra.vercel.app")).toBe(
      "https://background-agents-vercel-infra.vercel.app"
    );
  });

  it("trims whitespace and trailing slashes before normalizing", () => {
    expect(normalizeSandboxApiBaseUrl("  foo.vercel.app/  ")).toBe("https://foo.vercel.app");
  });

  it("leaves http and https URLs unchanged", () => {
    expect(normalizeSandboxApiBaseUrl("https://x.vercel.app")).toBe("https://x.vercel.app");
    expect(normalizeSandboxApiBaseUrl("http://localhost:3000/")).toBe("http://localhost:3000");
  });

  it("throws on empty after trim", () => {
    expect(() => normalizeSandboxApiBaseUrl("   ")).toThrow(
      "VercelCompatClient requires SANDBOX_API_BASE_URL"
    );
  });
});
