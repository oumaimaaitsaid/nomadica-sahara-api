const { getAuth } = require('../config/betterAuth');
const sql = require('../config/neon');

const verifyToken = async (req, res, next) => {
    try {
        const [{ fromNodeHeaders }, auth] = await Promise.all([
            import('better-auth/node'),
            getAuth(),
        ]);
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!session?.user) {
            return res.status(401).json({ success: false, message: 'Authentication is required.' });
        }
        req.user = session.user;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
    }
};

const requirePartner = async (req, res, next) => {
    try {
        const [profile] = await sql`
            SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role
            FROM public.users u
            JOIN public.roles r ON r.id = u.role_id
            WHERE u.id = ${req.user.id} AND lower(r.name) = 'partner'
            LIMIT 1
        `;
        if (!profile) {
            return res.status(403).json({ success: false, message: 'Partner access is required.' });
        }
        req.partner = profile;
        return next();
    } catch {
        return res.status(500).json({ success: false, message: 'Unable to verify partner access.' });
    }
};

module.exports = { verifyToken, requirePartner };
