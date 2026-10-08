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

## Booking, Stripe payments, and tickets

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/API/V1/bookings` | Recalculate the price from the active product, save the booking, and return a Stripe Checkout URL |
| `GET` | `/API/V1/bookings/:reference` | Return booking and payment status; expose a ticket code only after payment |
| `GET` | `/API/V1/bookings/partner` | List booking requests for authenticated partners |
| `PATCH` | `/API/V1/bookings/partner/:id/status` | Update a booking; cancelling a Stripe-paid booking issues a full refund |
| `PATCH` | `/API/V1/bookings/partner/:id/payment` | Record an offline payment and email its ticket |
| `POST` | `/API/V1/stripe/webhook` | Verify Stripe events, confirm paid bookings, generate one ticket per traveler, and email them |

### Enable checkout

1. Copy the Stripe, Resend, and support email variables from `.env.example` into `.env`.
   Set a Stripe test secret key, a webhook signing secret, a Resend API key, and a verified `EMAIL_FROM` sender.
2. Apply the additive database migration with `npm run migrate:booking-payments`.
3. In Stripe, create a webhook endpoint at `/API/V1/stripe/webhook` for
   `checkout.session.completed` and `checkout.session.expired`; put its `whsec_...`
   signing secret in `STRIPE_WEBHOOK_SECRET`. For local development, forward those
   events to `http://localhost:5000/API/V1/stripe/webhook` with the Stripe CLI.
4. Set `FRONTEND_URL` to the frontend origin. EUR and MAD amounts come from the
   active product's `price` and `currency` columns; Stripe charges the full amount
   when the customer submits the existing booking form.

The verified webhook, rather than the browser redirect, marks a booking paid.
It creates one unique ticket code per traveler, linked to the same reservation
reference, and sends the set of tickets to the booking email in Spanish. The confirmation page refreshes while Stripe is completing
the webhook. Checkout sessions that expire are cancelled. The default cancellation
policy is a full refund for requests at least 24 hours before the activity, and a
full refund if the operator cancels. The policy is snapshotted on each booking and
can be changed per product in `products.cancellation_policy`. Partner cancellation
of a paid Stripe booking sends a full refund request to Stripe.

Products use the `price` column for the listed experience. Booking requests
recalculate totals from this price and the product type; comparison tiers are
not stored on products.

Existing Neon Managed Auth accounts are not imported. Recreate the partner credential with the seeder; the password is hashed using Better Auth and stored in its `account` table.
