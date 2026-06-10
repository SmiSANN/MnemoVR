import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { authRoute } from "./routes/auth";
import { rankingsRoute } from "./routes/rankings";
import { syncRoute } from "./routes/sync";
import { versionRoute } from "./routes/version";

const app = new Hono<{ Bindings: Env }>();

// CORS はブラウザからのクロスオリジン呼び出しのみを対象とする。
// 正規クライアント（Tauri / reqwest）は Origin を送らないため影響を受けない。
// 既定では全オリジンを拒否し、ALLOWED_ORIGINS に列挙したものだけ許可する。
app.use("*", (c, next) =>
  cors({
    origin: (origin) => {
      const allowed = (c.env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      return allowed.includes(origin) ? origin : null;
    },
  })(c, next),
);

// ヘルスチェック
app.get("/", (c) => c.json({ status: "ok", service: "mnemovr-server" }));

// API ルート登録
app.route("/api", versionRoute);
app.route("/api", authRoute);
app.route("/api", syncRoute);
app.route("/api", rankingsRoute);

export default app;

export type { Env };
