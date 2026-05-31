# Merchant Dashboard

Merchant-facing analytics dashboard with row-level scoping for authenticated merchants.

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env`:

```env
DATABASE_URL=postgres://user:pass@host:5432/dbname
AUTH_SESSION_SECRET=replace-with-random-long-secret
ADMIN_ASSET_BASE_URL=http://localhost:3000
ADMIN_ASSET_SHARED_SECRET=replace-with-shared-secret-from-dashboard-admin
```

`ADMIN_ASSET_BASE_URL` lets the merchant dashboard load uploaded images from `dashboard_admin`.
`ADMIN_ASSET_SHARED_SECRET` must match the value used in `dashboard_admin` so the merchant app can generate signed URLs for the protected asset route.

3. Generate or inspect the schema from the current database if needed:

```bash
pnpm db:introspect
```

4. Apply the Drizzle migration baseline:

```bash
pnpm db:migrate
```

5. Seed a merchant user mapping:

```bash
MERCHANT_EMAIL=... MERCHANT_USERNAME=... MERCHANT_PASSWORD=... MERCHANT_KEY=... pnpm db:seed:single-merchant-user
```

The seeded user is linked to a single `merchant_key`.

For `MERCHANT_PASSWORD_HASH`, use `salt_hex:hash_hex`. If `MERCHANT_PASSWORD_HASH` is provided, `MERCHANT_PASSWORD` is optional.

6. Normalize merchant keys if needed:

```bash
pnpm db:normalize:merchant-key
```

7. Preview merchant key normalization:

```bash
pnpm db:normalize:merchant-key
```

Apply it with:

```bash
pnpm db:normalize:merchant-key -- --apply
```

The merchant grouping key is `dim_merchant.uniq_merchant`.

8. Optional: preview empty `users.username` backfill from `dim_merchant.uniq_merchant`:

```bash
pnpm db:sync:usernames
```

Apply it with:

```bash
pnpm db:sync:usernames -- --apply
```

9. Optional: auto-create missing merchant users:

```bash
pnpm db:generate:merchant-users
```

## Docker Setup

Use `../docker-compose.yaml` from the root workspace.

This service uses:

- [`docker/Dockerfile`](./docker/Dockerfile)

Builds are run from `../docker-compose.yaml` with build context `./dashboard-merchant`.

Runtime secrets are read from `/.secrets/` at the root of the project, not from the Dockerfile:

- `database_url`
- `auth_session_secret`
- `admin_asset_shared_secret`

`ADMIN_ASSET_SHARED_SECRET` must match the value used in `dashboard_admin`.

### Docker Commands

Run from the root workspace `../`:

```bash
docker compose -f docker-compose.yaml up --build
docker compose -f docker-compose.yaml up --build dashboard-admin
docker compose -f docker-compose.yaml up --build dashboard-merchant
docker compose -f docker-compose.yaml run --rm schema-migrate
docker compose -f docker-compose.yaml down
docker compose -f docker-compose.yaml logs -f
```

If Postgres was started before and the data directory is dirty, reset the volume first:

```bash
docker compose -f docker-compose.yaml down -v
```

If you need to build this service image directly:

```bash
docker build -f docker/Dockerfile .
```

The `schema-migrate` service runs automatically before the apps start, so the database schema is applied before the dashboard queries the shared database.

## Database Scripts

### `pnpm db:normalize:merchant-key`

Preview merchants with more than one `merchant_key`, then remap them if approved.

Preview:

```bash
pnpm db:normalize:merchant-key
```

Apply:

```bash
pnpm db:normalize:merchant-key -- --apply
```

Effects when applied:
- updates `fact_transaction.merchant_key`

### `pnpm db:sync:usernames`

Preview or backfill empty `users.username` values from `dim_merchant.uniq_merchant`.

Preview:

```bash
pnpm db:sync:usernames
```

Apply:

```bash
pnpm db:sync:usernames -- --apply
```

### `pnpm db:seed:single-merchant-user`

Seed one merchant user for a merchant account.

Example with a plain-text password:

```bash
MERCHANT_EMAIL=merchant.demo@example.com \
MERCHANT_USERNAME=merchant_demo \
MERCHANT_PASSWORD=rahasia123 \
MERCHANT_KEY=c670d687-2b27-5382-8888-57db91d31f68 \
pnpm db:seed:single-merchant-user
```

Example with a password hash:

```bash
MERCHANT_EMAIL=merchant.demo@example.com \
MERCHANT_USERNAME=merchant_demo \
MERCHANT_PASSWORD_HASH='salt_hex:hash_hex' \
MERCHANT_KEY=c670d687-2b27-5382-8888-57db91d31f68 \
pnpm db:seed:single-merchant-user
```

### `pnpm db:generate:merchant-users`

Create merchant accounts in bulk for merchants that do not yet have an active user.

Example:

```bash
pnpm db:generate:merchant-users
```

Output:

```text
email,username,password,merchant_key
merchant_a@merchant.local,merchant_a,AbC123xYz890,c670d687-2b27-5382-8888-57db91d31f68
```

Save the password output if the account will be used for login.

### `pnpm db:delete:merchant-users`

Delete all user accounts linked to merchants.

Dry run:

```bash
pnpm db:delete:merchant-users
```

### `pnpm db:set:user-password`

Update one user password by `USER_EMAIL` or `USER_USERNAME`.

Example by email:

```bash
USER_EMAIL=merchant.demo@example.com \
NEW_PASSWORD=rahasia123 \
pnpm db:set:user-password
```

Example by username with a password hash:

```bash
USER_USERNAME=merchant_demo \
NEW_PASSWORD_HASH='salt_hex:hash_hex' \
pnpm db:set:user-password
```

## Recommended Flow

If you are bootstrapping merchant auth data from an existing database, the safe order is:

1. `pnpm db:migrate`
2. `pnpm db:normalize:merchant-key`
3. `pnpm db:normalize:merchant-key -- --apply`
4. `pnpm db:sync:usernames`
5. `pnpm db:sync:usernames -- --apply`
6. `pnpm db:generate:merchant-users` or `pnpm db:seed:single-merchant-user`

## Auth Flow

- `POST /api/auth/login` sets a secure `httpOnly` cookie session
- `POST /api/auth/logout` clears the session cookie
- `GET /api/auth/session` returns merchant identity from the session

## Security Model

- Dashboard APIs resolve merchant context from session -> `user_accounts`
- API queries enforce merchant scoping through the session-bound merchant identity
- Client-provided merchant identity is ignored

## Merchant Dashboard Routes

- `/login`
- `/` (Overview)
- `/operational`
