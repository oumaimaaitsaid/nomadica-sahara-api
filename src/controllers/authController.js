const authService = require('../services/authService');
const {
    loginWithEmail,
    logoutSession,
    registerPartner,
    getGoogleAuthUrl,
} = authService;

const { loginPartnerSchema, registerPartnerSchema } = require('../schemas/authSchema');

const loginPartner = async (req, res) => {
    try {
        const validatedData = loginPartnerSchema.parse(req.body);
        const { data, error } = await loginWithEmail(req, res, validatedData.email, validatedData.password);

        if (error) {
            const statusCode = String(error.code).toLowerCase().includes('invalid') ? 401 : 400;
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

const logoutPartner = async (req, res) => {
    const { error } = await logoutSession(req, res);
    if (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(200).json({ success: true, message: 'Logout successful' });
};

const registerNewPartner = async (req, res) => {
    try {
        const validatedData = registerPartnerSchema.parse(req.body);

        const { data, error } = await registerPartner(
            req,
            res,
            validatedData.firstName,
            validatedData.lastName,
            validatedData.email,
            validatedData.password
        );

        if (error) {
            const statusCode = String(error.code).toLowerCase().includes('already') ? 409 : 400;
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
        const data = await getGoogleAuthUrl(req, res);

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

module.exports = {
    loginPartner,
    logoutPartner,
    registerNewPartner,
    googleLogin,
};
