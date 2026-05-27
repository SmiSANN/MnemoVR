# MnemoVR 管理操作

## 実行方法

**wrangler CLI:**
```sh
wrangler d1 execute mnemovr-db --command "..."
```

**Cloudflare Dashboard:**
D1 → mnemovr-db → Query タブに貼り付けて実行

---

## ユーザー一覧

```sql
SELECT id, display_name, provider, provider_user_id, is_banned, created_at FROM users ORDER BY id DESC;
```

## BAN

```sql
UPDATE users SET is_banned = 1 WHERE id = ?;
```

## BAN 解除

```sql
UPDATE users SET is_banned = 0 WHERE id = ?;
```
