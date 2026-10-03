const express = require('express');
const {
    loginPartner,
    registerNewPartner,
    googleLogin,
    generatePartnerTotp,
    verifyPartnerTotp,
} = require('../controllers/authController');
const router = express.Router();

const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/profile', verifyToken, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'You have access to this protected route!',
        user: req.user,
    });
});

router.post('/login/partner', loginPartner);
router.post('/register/partner', registerNewPartner);
router.get('/google', googleLogin);
router.post('/2fa/setup', verifyToken, generatePartnerTotp);
router.post('/2fa/verify', verifyToken, verifyPartnerTotp);

module.exports = router;