const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const sql = require('../config/neon');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const DEFAULT_CANCELLATION_POLICY = 'Cancelación gratuita hasta 24 horas antes de la actividad. Después de ese plazo, contacta con soporte. Si el operador cancela la actividad, recibirás un reembolso completo.';

function localizedBookingPaths(locale, offerId) {
    const encodedOffer = encodeURIComponent(offerId);
    if (locale === 'es') return { booking: `/es/reservar/${encodedOffer}`, confirmation: `/es/reservar/${encodedOffer}/confirmacion` };
    if (locale === 'pt') return { booking: `/pt/reservar/${encodedOffer}`, confirmation: `/pt/reservar/${encodedOffer}/confirmacao` };
    return { booking: `/en/book/${encodedOffer}`, confirmation: `/en/book/${encodedOffer}/confirmation` };
}

async function createStripeCheckout(booking, locale) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured.');
    const paths = localizedBookingPaths(locale, `${booking.product_slug}--${booking.offer_tier}`);
    const form = new URLSearchParams({
        mode: 'payment',
        success_url: `${FRONTEND_URL}${paths.confirmation}?ref=${encodeURIComponent(booking.reference)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${FRONTEND_URL}${paths.booking}?payment=cancelled`,
        customer_email: booking.customer_email,
        client_reference_id: booking.reference,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': booking.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(Math.round(Number(booking.total) * 100)),
        'line_items[0][price_data][product_data][name]': booking.product_title,
        'metadata[booking_reference]': booking.reference,
    });
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
    });
    const session = await response.json();
    if (!response.ok || !session.url || !session.id) throw new Error(session.error?.message || 'Could not create Stripe Checkout session.');
    return session;
}

function verifyStripeSignature(rawBody, signatureHeader) {
    if (!process.env.STRIPE_WEBHOOK_SECRET || !Buffer.isBuffer(rawBody) || !signatureHeader) return false;
    const parts = signatureHeader.split(',').reduce((result, part) => {
        const [key, value] = part.split('=', 2);
        (result[key] ||= []).push(value);
        return result;
    }, {});
    const timestamp = Number(parts.t?.[0]);
    if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
    const expected = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(rawBody).digest();
    return (parts.v1 || []).some((value) => {
        try {
            const received = Buffer.from(value, 'hex');
            return received.length === expected.length && timingSafeEqual(received, expected);
        } catch { return false; }
    });
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function sendTicketEmail(booking) {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Ticket email is not configured.');
    const date = String(booking.booking_date).slice(0, 10);
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM;
    const ticketRows = booking.tickets.map((ticket) => `<li style="margin:12px 0"><b>Entrada ${escapeHtml(ticket.ticket_number)}</b><br><span style="font-family:monospace;font-size:20px;letter-spacing:2px">${escapeHtml(ticket.ticket_code)}</span><br><small>Referencia de reserva: ${escapeHtml(booking.reference)}</small></li>`).join('');
    const html = `<div style="font-family:Arial,sans-serif;color:#173b32;max-width:600px;margin:auto"><h1>Tus entradas para ${escapeHtml(booking.product_title)}</h1><p>Hola ${escapeHtml(booking.customer_name)},</p><p>El pago se ha confirmado. Cada viajero tiene una entrada propia; todas pertenecen a la misma reserva.</p><div style="padding:20px;background:#f3f7ed;border-radius:12px"><p><b>Actividad:</b> ${escapeHtml(booking.product_title)}</p><p><b>Fecha:</b> ${escapeHtml(date)}</p><p><b>Personas:</b> ${escapeHtml(booking.travelers)}</p><p><b>Total pagado:</b> ${escapeHtml(booking.total)} ${escapeHtml(booking.currency)}</p><p><b>Referencia de reserva compartida:</b> ${escapeHtml(booking.reference)}</p><ol>${ticketRows}</ol></div><h2>Política de cancelación</h2><p>${escapeHtml(booking.cancellation_policy || DEFAULT_CANCELLATION_POLICY)}</p><p>Si el operador cancela la actividad, recibirás un reembolso completo. Para solicitar una cancelación, escribe a <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p></div>`;
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `booking-ticket/${booking.reference}` },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [booking.customer_email], reply_to: process.env.SUPPORT_EMAIL || undefined, subject: `Tu entrada: ${booking.product_title} (${booking.reference})`, html }),
    });
    if (!response.ok) throw new Error(`Resend email failed: ${await response.text()}`);
}

async function issueBookingTickets(booking) {
    const count = Number(booking.travelers);
    for (let number = 1; number <= count; number += 1) {
        await sql`
            INSERT INTO public.booking_tickets (booking_id, booking_reference, ticket_number, ticket_code)
            SELECT id, reference, ${number}, ${`NS-TKT-${randomBytes(10).toString('hex').toUpperCase()}`}
            FROM public.booking_requests WHERE reference = ${booking.reference}
            ON CONFLICT (booking_id, ticket_number) DO NOTHING
        `;
    }
    const tickets = await sql`
        SELECT ticket_number, ticket_code FROM public.booking_tickets
        WHERE booking_reference = ${booking.reference} ORDER BY ticket_number ASC
    `;
    if (tickets.length !== count) throw new Error('Could not issue a ticket for each traveler.');
    await sql`UPDATE public.booking_requests SET ticket_code = ${tickets[0].ticket_code} WHERE reference = ${booking.reference}`;
    return tickets;
}

async function refundStripePayment(paymentIntentId, reference) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured.');
    const response = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `booking-refund/${reference}` },
        body: new URLSearchParams({ payment_intent: paymentIntentId }),
    });
    const refund = await response.json();
    if (!response.ok || !['succeeded', 'pending'].includes(refund.status)) throw new Error(refund.error?.message || 'Stripe refund failed.');
}

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
    const match = /^(.*)--base$/.exec(offerId);
    if (!match || !match[1]) return null;
    const [, slug] = match;
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
    return { slug, tier: 'base', date, travelers, name, email, countryCode, phone, pickup, notes };
}

async function createBookingRequest(req, res) {
    const input = validatePayload(req.body);
    if (!input) return res.status(400).json({ success: false, error: 'serverError' });
    if (input.error) return res.status(400).json({ success: false, error: input.error });
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
        return res.status(503).json({ success: false, error: 'serverError' });
    }

    let bookingReference;
    try {
        const [product] = await sql`
            SELECT id, slug, title, price, currency, type, cancellation_policy
            FROM public.products
            WHERE status = 'active' AND lower(slug) = lower(${input.slug})
            LIMIT 1
        `;
        if (!product) return res.status(404).json({ success: false, error: 'serverError' });

        const unit = product.type === 'hotel' ? 'group' : product.type === 'private-tour' ? 'vehicle' : 'person';
        const unitPrice = Number(product.price);
        const total = Math.round(unitPrice * (unit === 'person' || unit === 'ticket' ? input.travelers : 1) * 100) / 100;
        const now = new Date();
        const dateStamp = new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now).replace(/-/g, '');
        const reference = `NS-${dateStamp}-${randomBytes(9).toString('hex').toUpperCase()}`;
        bookingReference = reference;
        const [booking] = await sql`
            INSERT INTO public.booking_requests (
                reference, product_id, product_slug, product_title, offer_tier,
                unit_price, currency, total, booking_date, travelers, pickup, notes,
                customer_name, customer_email, country_code, customer_phone, cancellation_policy
            ) VALUES (
                ${reference}, ${product.id}, ${product.slug}, ${product.title}, ${input.tier},
                ${unitPrice}, ${product.currency}, ${total}, ${input.date}, ${input.travelers}, ${input.pickup}, ${input.notes},
                ${input.name}, ${input.email}, ${input.countryCode}, ${input.phone}, ${product.cancellation_policy || DEFAULT_CANCELLATION_POLICY}
            ) RETURNING reference, product_slug, product_title, offer_tier, unit_price, currency, total,
                booking_date, travelers, status, created_at
        `;
        const locale = ['es', 'en', 'pt'].includes(req.body?.locale) ? req.body.locale : 'es';
        const session = await createStripeCheckout({ ...booking, customer_email: input.email }, locale);
        await sql`UPDATE public.booking_requests SET checkout_session_id = ${session.id} WHERE reference = ${reference}`;
        return res.status(201).json({ success: true, booking: { reference: booking.reference }, checkoutUrl: session.url });
    } catch (error) {
        if (bookingReference) {
            try { await sql`UPDATE public.booking_requests SET status = 'cancelled' WHERE reference = ${bookingReference} AND payment_status = 'unpaid'`; } catch { /* Preserve the checkout error. */ }
        }
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
                booking_date, travelers, status, payment_status,
                CASE WHEN payment_status = 'paid' THEN ticket_code ELSE NULL END AS ticket_code,
                (ticket_email_sent_at IS NOT NULL) AS ticket_email_sent,
                cancellation_policy, created_at
            FROM public.booking_requests
            WHERE reference = ${reference}
            LIMIT 1
        `;
        if (!booking) return res.status(404).json({ success: false });
        const tickets = booking.payment_status === 'paid' ? await sql`
            SELECT ticket_number, ticket_code FROM public.booking_tickets
            WHERE booking_reference = ${reference} ORDER BY ticket_number ASC
        ` : [];
        return res.json({ success: true, booking: { ...booking, tickets } });
    } catch (error) {
        console.error('[bookings:get] failed', { code: error.code, message: error.message });
        return res.status(500).json({ success: false });
    }
}

async function handleStripeWebhook(req, res) {
    if (!verifyStripeSignature(req.body, req.headers['stripe-signature'])) {
        return res.status(400).send('Invalid Stripe signature.');
    }
    let event;
    try { event = JSON.parse(req.body.toString('utf8')); }
    catch { return res.status(400).send('Invalid Stripe event.'); }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data?.object;
            const reference = session?.metadata?.booking_reference || session?.client_reference_id;
            if (session?.payment_status !== 'paid' || !reference) return res.json({ received: true });
            const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;
            const [booking] = await sql`
                UPDATE public.booking_requests
                SET payment_status = 'paid', status = 'confirmed', stripe_payment_intent_id = ${paymentIntent}
                WHERE reference = ${reference} AND checkout_session_id = ${session.id} AND status <> 'cancelled'
                RETURNING id, reference, product_title, booking_date, travelers, total, currency, customer_name,
                    customer_email, cancellation_policy, ticket_email_sent_at
            `;
            if (!booking) return res.json({ received: true });
            booking.tickets = await issueBookingTickets(booking);
            booking.ticket_code = booking.tickets[0].ticket_code;
            if (!booking.ticket_email_sent_at) {
                await sendTicketEmail(booking);
                await sql`UPDATE public.booking_requests SET ticket_email_sent_at = now() WHERE reference = ${reference} AND ticket_email_sent_at IS NULL`;
            }
        } else if (event.type === 'checkout.session.expired') {
            const session = event.data?.object;
            const reference = session?.metadata?.booking_reference || session?.client_reference_id;
            if (reference) await sql`
                UPDATE public.booking_requests SET status = 'cancelled'
                WHERE reference = ${reference} AND checkout_session_id = ${session.id} AND payment_status = 'unpaid'
            `;
        }
        return res.json({ received: true });
    } catch (error) {
        console.error('[stripe:webhook] failed', { type: event.type, message: error.message });
        // Stripe retries non-2xx webhook responses; this lets a temporary email/API outage recover.
        return res.status(500).send('Webhook processing failed.');
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
        if (status === 'cancelled') {
            const [current] = await sql`
                SELECT reference, payment_status, stripe_payment_intent_id
                FROM public.booking_requests WHERE id = ${req.params.id}::uuid LIMIT 1
            `;
            if (!current) return res.status(404).json({ success: false, message: 'Booking not found.' });
            if (current.payment_status === 'paid') {
                if (!current.stripe_payment_intent_id) return res.status(409).json({ success: false, message: 'This booking must be refunded manually before cancellation.' });
                await refundStripePayment(current.stripe_payment_intent_id, current.reference);
                await sql`UPDATE public.booking_requests SET payment_status = 'refunded' WHERE id = ${req.params.id}::uuid`;
            }
        }
        const [row] = await sql`
            UPDATE public.booking_requests SET status = ${status}
            WHERE id = ${req.params.id}::uuid
            RETURNING id, status
        `;
        if (!row) return res.status(404).json({ success: false, message: 'Booking not found.' });
        return res.json({ success: true, booking: row });
    } catch (error) {
        console.error('[bookings:status] failed', { code: error.code, message: error.message });
        return res.status(error.code === '22P02' ? 400 : 502).json({ success: false, message: 'Unable to update booking status or issue its refund.' });
    }
}

async function markPartnerBookingPaid(req, res) {
    try {
        const [row] = await sql`
            UPDATE public.booking_requests SET payment_status = 'paid', status = 'confirmed'
            WHERE id = ${req.params.id}::uuid AND status <> 'cancelled'
            RETURNING id, reference, status, payment_status, product_title, booking_date, travelers,
                total, currency, customer_name, customer_email, ticket_code, cancellation_policy, ticket_email_sent_at
        `;
        if (!row) return res.status(404).json({ success: false, message: 'Booking not found or cancelled.' });
        row.tickets = await issueBookingTickets(row);
        row.ticket_code = row.tickets[0].ticket_code;
        if (!row.ticket_email_sent_at) {
            await sendTicketEmail(row);
            await sql`UPDATE public.booking_requests SET ticket_email_sent_at = now() WHERE reference = ${row.reference} AND ticket_email_sent_at IS NULL`;
        }
        return res.json({ success: true, booking: { id: row.id, status: row.status, payment_status: row.payment_status, ticket_code: row.ticket_code } });
    } catch (error) {
        console.error('[bookings:payment] failed', { code: error.code, message: error.message });
        return res.status(error.code === '22P02' ? 400 : 500).json({ success: false, message: 'Unable to update booking payment.' });
    }
}

module.exports = { createBookingRequest, getBookingConfirmation, handleStripeWebhook, listPartnerBookings, updatePartnerBookingStatus, markPartnerBookingPaid };
