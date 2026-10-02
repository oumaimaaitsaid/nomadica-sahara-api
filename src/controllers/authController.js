const { loginWithEmail, registerPartner } = require('../services/authService');
const { loginPartnerSchema, registerPartnerSchema } = require('../schemas/authSchema');

const loginPartner = async (req, res) => {
    try {
        const validatedData = loginPartnerSchema.parse(req.body);
        const { data, error } = await loginWithEmail(validatedData.email, validatedData.password);

        if (error) {
            return res.status(401).json({ success: false, message: error.message });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful",
            session: data.session,
            user: data.user
        });

    } catch (error) {
        if (error.errors) {
            return res.status(400).json({ success: false, errors: error.errors });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
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
            return res.status(400).json({ success: false, message: error.message });
        }

        return res.status(201).json({
            success: true,
            message: "Partner registered successfully",
            user: data.user
        });

    } catch (error) {
        if (error.errors) {
            return res.status(400).json({ success: false, errors: error.errors });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = { loginPartner, registerNewPartner };