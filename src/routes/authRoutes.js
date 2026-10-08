const express = require('express');
const sql = require('../config/neon');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/profile', verifyToken, async (req, res) => {
    try {
        const [profile] = await sql`
            SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role
            FROM public.users u
            LEFT JOIN public.roles r ON r.id = u.role_id
            WHERE u.id = ${req.user.id}
            LIMIT 1
        `;
        if (!profile || profile.role !== 'partner') {
            return res.status(403).json({ success: false, message: 'Partner access is required.' });
        }
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
        return res.status(200).json({
            success: true,
            user: {
                ...req.user,
                ...profile,
                full_name: fullName || req.user.name || '',
                phone: req.user.phone || null,
                bio: req.user.bio || null,
            },
        });
    } catch {
        return res.status(500).json({ success: false, message: 'Unable to load profile.' });
    }
});

module.exports = router;
