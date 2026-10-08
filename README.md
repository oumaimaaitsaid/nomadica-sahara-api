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

Bring the public product catalog schema and optional category images under
migration control with:

```bash
npm run migrate:catalog
```

Create the public booking request table with:

```bash
npm run migrate:bookings
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

## Category API

`GET /API/V1/categories` is public for site navigation. Category mutations and
single-category management routes require a valid partner session. Category
images are optional on create and update.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/API/V1/categories` | Public list of categories |
| `GET` | `/API/V1/categories/:id` | Get one category |
| `POST` | `/API/V1/categories` | Create category with one `image` file |
| `PUT` | `/API/V1/categories/:id` | Update category and optionally replace its image |
| `DELETE` | `/API/V1/categories/:id` | Delete category and its image |

## Public product API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/API/V1/products` | List active products |
| `GET` | `/API/V1/products/:slug` | Get one active product by slug |

## Booking requests

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/API/V1/bookings` | Validate and save a booking request; pricing is recalculated from the active product |
| `GET` | `/API/V1/bookings/:reference` | Return a non-sensitive booking confirmation summary |
| `GET` | `/API/V1/bookings/partner` | List booking requests for authenticated partners |
| `PATCH` | `/API/V1/bookings/partner/:id/status` | Update a request status as an authenticated partner |
| `PATCH` | `/API/V1/bookings/partner/:id/payment` | Record manual payment and confirm the request |

Requests are saved with `pending` status. This flow records a booking request;
it does not confirm availability or collect payment.

Products use `price` for a single-price experience. To expose the existing
three-tier comparison UI for a product, set its optional `pricing_options`
JSONB value to this shape; the public API includes it and the frontend reads
the tiers without using the old local tour mock:

```json
{
  "unit": "person",
  "tiers": {"economic": 40, "standard": 65, "premium": 90},
  "tierSummary": {
    "economic": "Basic experience",
    "standard": "Recommended experience",
    "premium": "Premium experience"
  }
}
```

Leave `pricing_options` null for a single-price product. No comparison tiers
are inferred from `price` or `discount`.

Existing Neon Managed Auth accounts are not imported. Recreate the partner credential with the seeder; the password is hashed using Better Auth and stored in its `account` table.
