import app from "../src/index";
import { handle } from "hono/vercel";

const handler = handle(app);

function rewriteToRootPath(request: Request): Request {
  const url = new URL(request.url);

  // Vercel functions under /api/*; strip this prefix so Hono routes remain /api-*.
  if (url.pathname.startsWith("/api/")) {
    url.pathname = url.pathname.slice(4);
  }

  return new Request(url, request);
}

function routeRequest(request: Request, context: unknown) {
  return handler(rewriteToRootPath(request), context as never);
}

export const GET = routeRequest;
export const POST = routeRequest;
export const PUT = routeRequest;
export const PATCH = routeRequest;
export const DELETE = routeRequest;
export const OPTIONS = routeRequest;
