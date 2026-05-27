import { Hono } from "hono";
import type { Env } from "../types";
import { VERSION_CACHE_S_MAXAGE } from "../constants";

const VERSION_CACHE_KEY = new Request("https://mnemovr-cache/api/version");

export const versionRoute = new Hono<{ Bindings: Env }>();

versionRoute.get("/version", async (c) => {
  const cache = caches.default;
  const cached = await cache.match(VERSION_CACHE_KEY);
  if (cached) return new Response(cached.body, cached);

  const row = await c.env.DB
    .prepare("SELECT value FROM app_config WHERE key = 'latest_version'")
    .first<{ value: string }>();
  const res = c.json({ version: row?.value ?? "0.0.0" });
  res.headers.set("Cache-Control", `s-maxage=${VERSION_CACHE_S_MAXAGE}`);
  c.executionCtx.waitUntil(cache.put(VERSION_CACHE_KEY, res.clone()));
  return res;
});
