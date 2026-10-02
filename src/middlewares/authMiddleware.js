const supabase = require('../config/supabase');

const verifyToken = async (req, res, next) => {
    try {
        // 1. Get the token from the Authorization header (Format: "Bearer <token>")
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: "Access denied. No token provided or invalid format." 
            });
        }

        const token = authHeader.split(' ')[1];

        // 2. Verify the token with Supabase
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(403).json({ 
                success: false, 
                message: "Invalid or expired token." 
            });
        }

        // 3. Attach the user object to the request so controllers can use it
        req.user = data.user;
        
        // 4. Move to the next middleware or controller
        next();
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error during authentication." 
        });
    }
};

module.exports = { verifyToken };