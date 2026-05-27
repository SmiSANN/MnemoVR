import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { authRoute } from "./routes/auth";
import { rankingsRoute } from "./routes/rankings";
import { syncRoute } from "./routes/sync";
import { versionRoute } from "./routes/version";

const app = new Hono<{ Bindings: Env }>();

// 全エンドポイントに CORS を適用（クライアントは localhost から接続）
app.use("*", cors());

// ヘルスチェック
app.get("/", (c) => c.json({ status: "ok", service: "mnemovr-server" }));

// API ルート登録
app.route("/api", versionRoute);
app.route("/api", authRoute);
app.route("/api", syncRoute);
app.route("/api", rankingsRoute);

export default app;

export type { Env };
