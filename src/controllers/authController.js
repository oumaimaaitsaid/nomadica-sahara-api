const authService = require('../services/authService');
const {
    loginWithEmail,
    registerPartner,
    getGoogleAuthUrl,
    enrollPartnerTotp,
    challengePartnerTotp,
    verifyPartnerTotp: verifyPartnerTotpService,
} = authService;

const { loginPartnerSchema, registerPartnerSchema } = require('../schemas/authSchema');

const loginPartner = async (req, res) => {
    try {
        const validatedData = loginPartnerSchema.parse(req.body);
        const { data, error } = await loginWithEmail(validatedData.email, validatedData.password);

        if (error) {
            const statusCode = error.code === 'invalid_credentials' ? 401 : 400;
            return res.status(statusCode).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            session: data.session,
            user: data.user,
        });
    } catch (error) {
        if (error.issues || error.errors) {
            return res.status(400).json({
                success: false,
                errors: error.issues || error.errors,
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

const registerNewPartner = async (req, res) => {
    try {
        const validatedData = registerPartnerSchema.parse(req.body);

        const { data, error } = await registerPartner(
            validatedData.firstName,
            validatedData.lastName,
            validatedData.email,
            validatedData.password
        );

        if (error) {
            const statusCode = error.code === 'user_already_exists' ? 409 : 400;
            return res.status(statusCode).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Partner registered successfully',
            user: data.user,
            session: data.session || null,
        });
    } catch (error) {
        if (error.issues || error.errors) {
            return res.status(400).json({
                success: false,
                errors: error.issues || error.errors,
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

const googleLogin = async (req, res) => {
    try {
        const data = await getGoogleAuthUrl();

        return res.status(200).json({
            success: true,
            url: data.url,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

const generatePartnerTotp = async (req, res) => {
    try {
        const setup = await enrollPartnerTotp();

        return res.status(200).json({
            success: true,
            message: 'TOTP setup generated successfully',
            data: setup,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

const verifyPartnerTotp = async (req, res) => {
    try {
        const { factorId, code } = req.body;

        if (!factorId || !code) {
            return res.status(400).json({
                success: false,
                message: 'factorId and code are required',
            });
        }

        const challenge = await challengePartnerTotp(factorId);

        const verification = await verifyPartnerTotpService({
            factorId,
            challengeId: challenge.id,
            code,
        });

        return res.status(200).json({
            success: true,
            message: '2FA verification successful',
            data: verification,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    loginPartner,
    registerNewPartner,
    googleLogin,
    generatePartnerTotp,
    verifyPartnerTotp,
};