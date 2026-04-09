## Merchant Dashboard

Merchant-facing analytics dashboard with row-level scoping per authenticated merchant.

### Required env

Create `.env` with:

```bash
DATABASE_URL=postgres://user:pass@host:5432/dbname
AUTH_SESSION_SECRET=replace-with-random-long-secret
```

### Database setup

1. Generate or inspect schema from the current database if needed:

`pnpm db:introspect`

2. Apply Drizzle migration baseline:

`pnpm db:migrate`

3. Seed a merchant user mapping using:

`MERCHANT_EMAIL=... MERCHANT_USERNAME=... MERCHANT_PASSWORD=... MERCHANT_KEY=... pnpm db:seed:merchant-user`

Default scope adalah `merchant`, artinya user hanya terhubung ke 1 `merchant_key`.
Kalau user harus mewakili 1 canonical merchant yang punya beberapa `merchant_key`, set `MERCHANT_SCOPE_TYPE=canonical`.

For `MERCHANT_PASSWORD_HASH`, use `salt_hex:hash_hex`. If `MERCHANT_PASSWORD_HASH` is provided, `MERCHANT_PASSWORD` is optional.

4. Sync canonical merchant mapping table (groups multiple `merchant_key` per `uniq_merchant`):

`pnpm db:sync:canonical-map`

5. If one merchant brand has multiple `merchant_key` values, preview normalization:

`pnpm db:normalize:merchant-key`

Apply it with:

`pnpm db:normalize:merchant-key -- --apply`

Canonical grouping key is `dim_merchant.uniq_merchant`.

6. (Optional) Preview empty `users.username` backfill from `dim_merchant.uniq_merchant`:

`pnpm db:sync:usernames`

Apply it with:

`pnpm db:sync:usernames -- --apply`

7. (Optional) Auto-create missing merchant users from canonical mapping:

`pnpm db:create:merchant-users`

### Database scripts

#### `pnpm db:sync:canonical-map`

Sync isi `merchant_canonical_map` dari `dim_merchant`.

Pakai saat:
- ada perubahan data `dim_merchant`
- ingin refresh `canonical_merchant_key` per `uniq_merchant`

Contoh:

```bash
pnpm db:sync:canonical-map
```

#### `pnpm db:normalize:merchant-key`

Preview merchant dengan lebih dari satu `merchant_key`, lalu jika disetujui remap ke canonical key.

Preview:

```bash
pnpm db:normalize:merchant-key
```

Apply:

```bash
pnpm db:normalize:merchant-key -- --apply
```

Efek saat apply:
- update `merchant_users`
- update `dim_rule.rule_merchant`
- update `fact_transaction.merchant_key`

#### `pnpm db:sync:usernames`

Preview atau isi `users.username` yang kosong dari `dim_merchant.uniq_merchant`.

Preview:

```bash
pnpm db:sync:usernames
```

Apply:

```bash
pnpm db:sync:usernames -- --apply
```

#### `pnpm db:seed:merchant-user`

Seed 1 merchant user dan mapping ke `merchant_users`.

`MERCHANT_SCOPE_TYPE` tersedia:
- `merchant`: user hanya akses `MERCHANT_KEY`
- `canonical`: user akses semua merchant dalam canonical group dari `MERCHANT_KEY`

Contoh dengan password plain text:

```bash
MERCHANT_EMAIL=merchant.demo@example.com \
MERCHANT_USERNAME=merchant_demo \
MERCHANT_PASSWORD=rahasia123 \
MERCHANT_KEY=c670d687-2b27-5382-8888-57db91d31f68 \
pnpm db:seed:merchant-user
```

Contoh akun canonical:

```bash
MERCHANT_EMAIL=merchant.group@example.com \
MERCHANT_USERNAME=merchant_group \
MERCHANT_PASSWORD=rahasia123 \
MERCHANT_KEY=c670d687-2b27-5382-8888-57db91d31f68 \
MERCHANT_SCOPE_TYPE=canonical \
pnpm db:seed:merchant-user
```

Contoh dengan password hash:

```bash
MERCHANT_EMAIL=merchant.demo@example.com \
MERCHANT_USERNAME=merchant_demo \
MERCHANT_PASSWORD_HASH='salt_hex:hash_hex' \
MERCHANT_KEY=c670d687-2b27-5382-8888-57db91d31f68 \
pnpm db:seed:merchant-user
```

#### `pnpm db:create:merchant-users`

Membuat akun merchant massal untuk canonical merchant yang belum punya user aktif.

Contoh:

```bash
pnpm db:create:merchant-users
```

Output:

```text
email,username,password,merchant_key
merchant_a@merchant.local,merchant_a,AbC123xYz890,c670d687-2b27-5382-8888-57db91d31f68
```

Simpan output password jika akun akan dipakai login.

### Recommended flow

Jika sedang bootstrap data auth merchant dari database existing, urutan yang aman:

1. `pnpm db:migrate`
2. `pnpm db:sync:canonical-map`
3. `pnpm db:normalize:merchant-key`
4. `pnpm db:normalize:merchant-key -- --apply`
5. `pnpm db:sync:usernames`
6. `pnpm db:sync:usernames -- --apply`
7. `pnpm db:create:merchant-users` atau `pnpm db:seed:merchant-user`

### Auth flow

- `POST /api/auth/login` sets secure httpOnly cookie session.
- `POST /api/auth/logout` clears session cookie.
- `GET /api/auth/session` returns merchant identity from session.

### Security model

- Dashboard APIs resolve merchant context from session -> `users` + `merchant_users`.
- API queries enforce `merchant_key = mapped merchant_key`.
- Client-provided merchant identity is ignored.

### Merchant dashboard routes

- `/login`
- `/` (Overview)
- `/operational`
