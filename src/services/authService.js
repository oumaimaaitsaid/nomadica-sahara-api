const { getAuth } = require('../config/betterAuth');

async function loginWithEmail(req, _res, email, password) {
    try {
        const auth = await getAuth();
        const data = await auth.api.signInEmail({
            headers: req.headers,
            body: { email: String(email).trim().toLowerCase(), password },
        });
        return { data, error: null };
    } catch (error) {
        return { data: null, error: { code: error.status || 'auth_error', message: error.message } };
    }
}

async function logoutSession(req) {
    try {
        const auth = await getAuth();
        const data = await auth.api.signOut({ headers: req.headers });
        return { data, error: null };
    } catch (error) {
        return { data: null, error: { code: error.status || 'auth_error', message: error.message } };
    }
}

async function registerPartner() {
    return { data: null, error: { code: 'sign_up_disabled', message: 'Partner registration is disabled.' } };
}

async function getGoogleAuthUrl() {
    throw new Error('Social sign-in is not configured for partner accounts.');
}

module.exports = { loginWithEmail, logoutSession, registerPartner, getGoogleAuthUrl };
