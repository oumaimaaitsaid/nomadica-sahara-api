const { getAuth } = require('../config/betterAuth');

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

module.exports = { verifyToken };
