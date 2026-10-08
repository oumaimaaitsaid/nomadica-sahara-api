const express = require('express');
const { verifyToken, requirePartner } = require('../middlewares/authMiddleware');
const { createBookingRequest, getBookingConfirmation, listPartnerBookings, updatePartnerBookingStatus, markPartnerBookingPaid } = require('../controllers/bookingController');

const router = express.Router();

router.post('/', createBookingRequest);
router.get('/partner', verifyToken, requirePartner, listPartnerBookings);
router.patch('/partner/:id/status', verifyToken, requirePartner, updatePartnerBookingStatus);
router.patch('/partner/:id/payment', verifyToken, requirePartner, markPartnerBookingPaid);
router.get('/:reference', getBookingConfirmation);

module.exports = router;
