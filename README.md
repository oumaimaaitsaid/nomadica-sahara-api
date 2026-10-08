# Nomadica Sahara API

Express API for Nomadica Sahara. Neon Postgres stores application data and Better Auth manages partner credentials, sessions, and optional TOTP two-factor authentication. Neon Managed Auth is not used.

## Environment

Copy `.env.example` to `.env`, then set the Neon connection string and a private Better Auth secret of at least 32 characters. Generate one with `openssl rand -base64 32`.

```env
PORT=5000
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-your-endpoint.region.aws.neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=your-random-secret-at-least-32-characters
BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_TRUSTED_PROXIES=127.0.0.1,::1
FRONTEND_URL=http://localhost:3000
```

Set `BETTER_AUTH_TRUSTED_PROXIES` to the IP addresses or CIDR ranges of the reverse proxies in front of the API. The frontend forwards the client IP to preserve per-client rate limits.

Two-factor authentication is enabled by default. For local development only, set `DISABLE_TWO_FACTOR=true` to temporarily let partner accounts sign in without an authenticator code. This disables two-factor enforcement for all accounts while enabled; keep it `false` in shared or production environments.

## Database setup

The existing application tables (`public.users`, `public.roles`) remain in Neon. Create the Better Auth tables by running:

```bash
npm run migrate:auth
```

The migration creates Better Auth user, account, session, verification, and two-factor records in the same Neon database. It does not add password data to `public.users`.

Create the categories table with:

```bash
npm run migrate:categories
```

For category images, provision a Neon Object Storage bucket with public read access, then set `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `NEON_STORAGE_BUCKET` from the Neon storage credentials. The API accepts one JPEG, PNG, or WebP image up to 5 MB and stores only its object key in Postgres.

## Create or reset the partner account

Set `PARTNER_EMAIL`, `PARTNER_PASSWORD`, `PARTNER_FIRST_NAME`, and `PARTNER_LAST_NAME` in `.env`, then run:

```bash
npm run seed:partner
```

The seeder creates or updates the Better Auth credential and the matching `public.users` partner profile. It also supports the previous `ADMIN_*` variables for local transition. Public sign-up is disabled.

## Run

```bash
npm install
node server.js
```

The API listens on `http://localhost:5000`. Better Auth endpoints are mounted at `/API/V1/auth/*`; partner profile is `GET /API/V1/profile`.

## Partner authentication

The frontend signs in through `/API/V1/auth/sign-in/email`, verifies an additional code through `/API/V1/auth/two-factor/verify-totp` when enabled, and signs out through `/API/V1/auth/sign-out`. In partner settings, the Security tab can enroll or disable TOTP and displays one-time recovery codes during setup.

## Partner category API

All category routes require a valid partner session:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/API/V1/categories` | List categories |
| `GET` | `/API/V1/categories/:id` | Get one category |
| `POST` | `/API/V1/categories` | Create category with one `image` file |
| `PUT` | `/API/V1/categories/:id` | Update category and optionally replace its image |
| `DELETE` | `/API/V1/categories/:id` | Delete category and its image |

Existing Neon Managed Auth accounts are not imported. Recreate the partner credential with the seeder; the password is hashed using Better Auth and stored in its `account` table.
