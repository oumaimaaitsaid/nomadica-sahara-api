CREATE TABLE IF NOT EXISTS "user" (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" text NOT NULL,
    "email" text NOT NULL UNIQUE,
    "emailVerified" boolean NOT NULL DEFAULT false,
    "image" text,
    "twoFactorEnabled" boolean NOT NULL DEFAULT false,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "expiresAt" timestamptz NOT NULL,
    "token" text NOT NULL UNIQUE,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now(),
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");

CREATE TABLE IF NOT EXISTS "account" (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamptz,
    "refreshTokenExpiresAt" timestamptz,
    "scope" text,
    "password" text,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");
ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "account_providerId_accountId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "account_providerId_userId_key" ON "account"("providerId", "userId");

CREATE TABLE IF NOT EXISTS "verification" (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expiresAt" timestamptz NOT NULL,
    "createdAt" timestamptz DEFAULT now(),
    "updatedAt" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "twoFactor" (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "secret" text NOT NULL,
    "backupCodes" text NOT NULL,
    "userId" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
    "verified" boolean NOT NULL DEFAULT true,
    "failedVerificationCount" integer NOT NULL DEFAULT 0,
    "lockedUntil" timestamptz,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "twoFactor" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
