const supabase = require('../config/supabase');

const loginWithEmail = async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
    });

    if (error) {
        return {
            data: null,
            error: {
                code: error.code || 'auth_error',
                message: error.message,
            },
        };
    }

    return { data, error: null };
};

const registerPartner = async (firstName, lastName, email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
            data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                role: 'partner',
            },
        },
    });

    if (authError) {
        return {
            data: null,
            error: {
                code: authError.code || 'auth_error',
                message: authError.message,
            },
        };
    }

    if (!authData?.user) {
        return {
            data: null,
            error: {
                code: 'missing_user',
                message: 'Registration succeeded but user data was not returned.',
            },
        };
    }

    const { error: dbError } = await supabase.from('users').insert([
        {
            id: authData.user.id,
            email: normalizedEmail,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role_id: 1,
        },
    ]);

    if (dbError) {
        return {
            data: null,
            error: {
                code: dbError.code || 'db_error',
                message: dbError.message,
            },
        };
    }

    return { data: authData, error: null };
};

const getGoogleAuthUrl = async () => {
    const redirectTo = process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL}/auth/callback`
        : 'http://localhost:3000/auth/callback';

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
        },
    });

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

const enrollPartnerTotp = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

    if (error) {
        throw new Error(error.message);
    }

    const factor = data?.factor ?? data ?? {};

    return {
        factorId: factor.id,
        type: factor.type || 'totp',
        secret: factor.secret || null,
        qrCode: factor.uri || factor.otpauth_uri || null,
    };
};

const challengePartnerTotp = async (factorId) => {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

const verifyPartnerTotp = async ({ factorId, challengeId, code }) => {
    const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
    });

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

module.exports = {
    loginWithEmail,
    registerPartner,
    getGoogleAuthUrl,
    enrollPartnerTotp,
    challengePartnerTotp,
    verifyPartnerTotp,
};