require('dotenv').config();
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function seedPartner() {
    const email = (process.env.PARTNER_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.PARTNER_PASSWORD || process.env.ADMIN_PASSWORD;
    const firstName = (process.env.PARTNER_FIRST_NAME || process.env.ADMIN_FIRST_NAME || 'Partner').trim();
    const lastName = (process.env.PARTNER_LAST_NAME || process.env.ADMIN_LAST_NAME || 'User').trim();
    if (!process.env.DATABASE_URL || !email || !password) {
        throw new Error('DATABASE_URL, PARTNER_EMAIL, and PARTNER_PASSWORD are required.');
    }

    const [{ hashPassword }, pool] = await Promise.all([
        import('better-auth/crypto'),
        Promise.resolve(new Pool({ connectionString: process.env.DATABASE_URL })),
    ]);
    const client = await pool.connect();
    try {
        const passwordHash = await hashPassword(password);
        await client.query('BEGIN');
        const roleResult = await client.query("SELECT id FROM public.roles WHERE lower(name) = 'partner' LIMIT 1");
        if (!roleResult.rows[0]) throw new Error('The partner role was not found in public.roles.');

        const authUser = await client.query(
            `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, true, now(), now())
             ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = now()
             RETURNING "id"`,
            [randomUUID(), `${firstName} ${lastName}`.trim(), email],
        );
        const userId = authUser.rows[0].id;
        await client.query(
            `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
             VALUES ($1, $2, 'credential', $2, $3, now(), now())
             ON CONFLICT ("providerId", "userId") DO UPDATE SET "accountId" = EXCLUDED."accountId",
                 "password" = EXCLUDED."password", "updatedAt" = now()`,
            [randomUUID(), userId, passwordHash],
        );
        await client.query(
            `INSERT INTO public.users (id, email, first_name, last_name, role_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, first_name = EXCLUDED.first_name,
                 last_name = EXCLUDED.last_name, role_id = EXCLUDED.role_id`,
            [userId, email, firstName, lastName, roleResult.rows[0].id],
        );
        await client.query('COMMIT');
        console.log(`Partner auth account and profile created for ${email}.`);
        console.log('The password hash is stored in Better Auth account records, not public.users.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seedPartner().catch((error) => {
    console.error(error.message || 'Partner seeding failed.');
    process.exitCode = 1;
});
