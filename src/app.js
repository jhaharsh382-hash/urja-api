import express from "express";
import { readFileSync } from "node:fs";
import { routes } from "./routes.js";
import { ApiError, PortalError } from "./errors.js";

export function createApp({ store }) {
  const app = express();
  app.disable("x-powered-by");
  const spec = readFileSync(new URL("../openapi.json", import.meta.url), "utf8");
  app.get("/openapi.json", (_req, res) => res.type("json").send(spec));
  // Rendered docs (Scalar, loaded from a CDN; the raw spec above works offline)
  app.get("/docs", (_req, res) => res.type("html").send(
    `<!doctype html><title>Urja Meter API</title><script id="api-reference" data-url="/openapi.json"></script>` +
    `<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>`));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use(routes(store));
  app.use((_req, _res, next) => next(new ApiError("Route not found", { status: 404, code: "not_found" })));
  // one place that maps errors to HTTP responses
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError || err instanceof PortalError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    console.error(err);
    res.status(500).json({ error: { code: "internal_error", message: "Unexpected error" } });
  });
  return app;
}
