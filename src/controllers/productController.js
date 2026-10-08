const sql = require('../config/neon');

async function listPublicProducts(_req, res) {
    try {
        const rows = await sql`
            SELECT id, type, title, slug, location, destination, image, gallery, price, currency,
                rating, review_count, description, duration, duration_hours, date, availability,
                category, tags, discount, featured, meeting_point, pickup_included, stars,
                hotel_facilities, vehicle_type, passengers, menu_type, show_included,
                treatment_duration, treatment, time, private_group_size, href, itinerary,
                status, created_at, updated_at
            FROM public.products
            WHERE status = 'active'
            ORDER BY featured DESC, created_at DESC, title ASC
        `;
        return res.json({ success: true, products: rows });
    } catch (error) {
        console.error('[products:list] failed', { code: error.code, message: error.message });
        return res.status(500).json({ success: false, message: 'Unable to load products.' });
    }
}

async function getPublicProduct(req, res) {
    const slug = String(req.params.slug || '').trim();
    if (!slug || slug.length > 180) return res.status(400).json({ success: false, message: 'Invalid product slug.' });
    try {
        const rows = await sql`
            SELECT id, type, title, slug, location, destination, image, gallery, price, currency,
                rating, review_count, description, duration, duration_hours, date, availability,
                category, tags, discount, featured, meeting_point, pickup_included, stars,
                hotel_facilities, vehicle_type, passengers, menu_type, show_included,
                treatment_duration, treatment, time, private_group_size, href, itinerary,
                status, created_at, updated_at
            FROM public.products
            WHERE status = 'active' AND lower(slug) = lower(${slug})
            LIMIT 1
        `;
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Product not found.' });
        return res.json({ success: true, product: rows[0] });
    } catch (error) {
        console.error('[products:get] failed', { code: error.code, message: error.message });
        return res.status(500).json({ success: false, message: 'Unable to load product.' });
    }
}

module.exports = { listPublicProducts, getPublicProduct };
