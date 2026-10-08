const { randomBytes } = require('node:crypto');
const sql = require('../config/neon');

const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date());
    return value >= today;
};

function validatePayload(input) {
    if (!input || typeof input !== 'object' || !input.form || typeof input.form !== 'object') return null;
    const { offerId, form } = input;
    if (typeof offerId !== 'string' || offerId.length > 240) return null;
    const match = /^(.*)--(base|economic|standard|premium)$/.exec(offerId);
    if (!match || !match[1]) return null;
    const [, slug, tier] = match;
    const date = form.date;
    const travelers = Number(form.travelers);
    const name = typeof form.name === 'string' ? form.name.trim() : '';
    const email = typeof form.email === 'string' ? form.email.trim().toLowerCase() : '';
    const countryCode = typeof form.countryCode === 'string' ? form.countryCode.trim() : '';
    const phone = typeof form.phone === 'string' ? form.phone.trim() : '';
    const pickup = typeof form.pickup === 'string' ? form.pickup.trim() : '';
    const notes = typeof form.notes === 'string' ? form.notes.trim() : '';
    if (!validDate(date)) return { error: 'dateRequired' };
    if (!Number.isInteger(travelers) || travelers < 1 || travelers > 20) return { error: 'travelersRequired' };
    if (name.length < 2 || name.length > 120) return { error: 'nameRequired' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: 'emailInvalid' };
    if (!/^\+\d{1,4}$/.test(countryCode) || phone.length < 5 || phone.length > 30) return { error: 'phoneRequired' };
    if (form.consent !== true) return { error: 'consentRequired' };
    if (pickup.length > 240 || notes.length > 1000) return { error: 'serverError' };
    return { slug, tier, date, travelers, name, email, countryCode, phone, pickup, notes };
}

async function createBookingRequest(req, res) {
    const input = validatePayload(req.body);
    if (!input) return res.status(400).json({ success: false, error: 'serverError' });
    if (input.error) return res.status(400).json({ success: false, error: input.error });

    try {
        const [product] = await sql`
            SELECT id, slug, title, price, currency, type, pricing_options
            FROM public.products
            WHERE status = 'active' AND lower(slug) = lower(${input.slug})
            LIMIT 1
        `;
        if (!product) return res.status(404).json({ success: false, error: 'serverError' });

        const options = product.pricing_options && typeof product.pricing_options === 'object' ? product.pricing_options : null;
        const unit = options?.unit || (product.type === 'hotel' ? 'group' : product.type === 'private-tour' ? 'vehicle' : 'person');
        let unitPrice;
        if (input.tier === 'base') {
            if (options?.tiers) return res.status(400).json({ success: false, error: 'serverError' });
            unitPrice = Number(product.price);
        } else {
            const tiers = options?.tiers;
            if (!tiers || !Number.isFinite(Number(tiers[input.tier])) || Number(tiers[input.tier]) < 0) {
                return res.status(400).json({ success: false, error: 'serverError' });
            }
            unitPrice = Number(tiers[input.tier]);
        }
        const total = Math.round(unitPrice * (unit === 'person' || unit === 'ticket' ? input.travelers : 1) * 100) / 100;
        const now = new Date();
        const dateStamp = new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now).replace(/-/g, '');
        const reference = `NS-${dateStamp}-${randomBytes(9).toString('hex').toUpperCase()}`;
        const [booking] = await sql`
            INSERT INTO public.booking_requests (
                reference, product_id, product_slug, product_title, offer_tier,
                unit_price, currency, total, booking_date, travelers, pickup, notes,
                customer_name, customer_email, country_code, customer_phone
            ) VALUES (
                ${reference}, ${product.id}, ${product.slug}, ${product.title}, ${input.tier},
                ${unitPrice}, ${product.currency}, ${total}, ${input.date}, ${input.travelers}, ${input.pickup}, ${input.notes},
                ${input.name}, ${input.email}, ${input.countryCode}, ${input.phone}
            ) RETURNING reference, product_slug, product_title, offer_tier, unit_price, currency, total,
                booking_date, travelers, status, created_at
        `;
        return res.status(201).json({ success: true, booking });
    } catch (error) {
        console.error('[bookings:create] failed', { code: error.code, message: error.message });
        return res.status(500).json({ success: false, error: 'serverError' });
    }
}

async function getBookingConfirmation(req, res) {
    const reference = String(req.params.reference || '').trim().toUpperCase();
    if (!/^NS-\d{8}-[A-F0-9]{18}$/.test(reference)) return res.status(404).json({ success: false });
    try {
        const [booking] = await sql`
            SELECT reference, product_slug, product_title, offer_tier, unit_price, currency, total,
                booking_date, travelers, status, created_at
            FROM public.booking_requests
            WHERE reference = ${reference}
            LIMIT 1
        `;
        if (!booking) return res.status(404).json({ success: false });
        return res.json({ success: true, booking });
    } catch (error) {
        console.error('[bookings:get] failed', { code: error.code, message: error.message });
        return res.status(500).json({ success: false });
    }
}

async function listPartnerBookings(req, res) {
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    try {
        const rows = await sql`
            SELECT id, reference AS booking_ref, customer_name AS tourist_name,
                customer_email AS tourist_email, concat(country_code, ' ', customer_phone) AS tourist_phone,
                booking_date::text AS trek_date, NULL::text AS trek_time, status, payment_status,
                'website'::text AS source, total AS total_price, created_at, travelers AS adults,
                0 AS children, pickup AS pickup_address, notes,
                jsonb_build_object('title', product_title, 'slug', product_slug) AS treks
            FROM public.booking_requests
            ORDER BY created_at DESC
            OFFSET ${offset} LIMIT ${limit}
        `;
        return res.json({ success: true, bookings: rows });
    } catch (error) {
        console.error('[bookings:list] failed', { code: error.code, message: error.message });
        return res.status(500).json({ success: false, message: 'Unable to load bookings.' });
    }
}

async function updatePartnerBookingStatus(req, res) {
    const { status } = req.body || {};
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid booking status.' });
    }
    try {
        const [row] = await sql`
            UPDATE public.booking_requests SET status = ${status}
            WHERE id = ${req.params.id}::uuid
            RETURNING id, status
        `;
        if (!row) return res.status(404).json({ success: false, message: 'Booking not found.' });
        return res.json({ success: true, booking: row });
    } catch (error) {
        console.error('[bookings:status] failed', { code: error.code, message: error.message });
        return res.status(error.code === '22P02' ? 400 : 500).json({ success: false, message: 'Unable to update booking status.' });
    }
}

async function markPartnerBookingPaid(req, res) {
    try {
        const [row] = await sql`
            UPDATE public.booking_requests SET payment_status = 'paid', status = 'confirmed'
            WHERE id = ${req.params.id}::uuid AND status <> 'cancelled'
            RETURNING id, status, payment_status
        `;
        if (!row) return res.status(404).json({ success: false, message: 'Booking not found or cancelled.' });
        return res.json({ success: true, booking: row });
    } catch (error) {
        console.error('[bookings:payment] failed', { code: error.code, message: error.message });
        return res.status(error.code === '22P02' ? 400 : 500).json({ success: false, message: 'Unable to update booking payment.' });
    }
}

module.exports = { createBookingRequest, getBookingConfirmation, listPartnerBookings, updatePartnerBookingStatus, markPartnerBookingPaid };
