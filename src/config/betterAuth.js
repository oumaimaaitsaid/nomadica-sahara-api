require('dotenv').config();

let authPromise;

async function getAuth() {
    if (!authPromise) {
        authPromise = (async () => {
            const [{ betterAuth }, { twoFactor }, { Pool }] = await Promise.all([
                import('better-auth'),
                import('better-auth/plugins'),
                import('pg'),
            ]);
            if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
            if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
                throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
            }
            const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
            const trustedProxies = (process.env.BETTER_AUTH_TRUSTED_PROXIES || '127.0.0.1,::1')
                .split(',').map((value) => value.trim()).filter(Boolean);
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            return betterAuth({
                appName: 'Toledano Viajes Partner Portal',
                baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`,
                basePath: '/API/V1/auth',
                secret: process.env.BETTER_AUTH_SECRET,
                database: pool,
                emailAndPassword: { enabled: true, autoSignIn: false, disableSignUp: true },
                trustedOrigins: [frontendOrigin],
                advanced: {
                    database: { generateId: 'uuid' },
                    ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'], trustedProxies },
                },
                plugins: [twoFactor({ issuer: 'Toledano Viajes' })],
            });
        })().catch((error) => {
            authPromise = undefined;
            throw error;
        });
    }
    return authPromise;
}

module.exports = { getAuth };
