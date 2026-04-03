import type { Context } from "hono";
import type { Env } from "./types";

/**
 * Cloudflare Workers pass bindings as `c.env`. On Vercel (Node), `c.env` is undefined and
 * configuration comes from `process.env`. Merge so bindings override when both exist (tests, Workers).
 */
export function resolveRuntimeEnv(c: Context<{ Bindings: Env }>): Env {
  const fromProcess: Env = {
    SANDBOX_API_SECRET: process.env.SANDBOX_API_SECRET ?? "",
    INTERNAL_CALLBACK_SECRET: process.env.INTERNAL_CALLBACK_SECRET ?? "",
    OPENINSPECT_GITHUB_TOKEN: process.env.OPENINSPECT_GITHUB_TOKEN,
    OPENINSPECT_BOOTSTRAP_CMD: process.env.OPENINSPECT_BOOTSTRAP_CMD,
    OPENINSPECT_BRIDGE_BOOT_CMD: process.env.OPENINSPECT_BRIDGE_BOOT_CMD,
    OPENINSPECT_SANDBOX_RUNTIME_PIP_SPEC: process.env.OPENINSPECT_SANDBOX_RUNTIME_PIP_SPEC,
  };
  const bindings = c.env;
  if (bindings === undefined || bindings === null) {
    return fromProcess;
  }
  return { ...fromProcess, ...bindings };
}
