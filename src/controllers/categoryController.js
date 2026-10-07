const { randomUUID } = require('node:crypto');
const sql = require('../config/neon');
const { deleteObject, getObjectUrl, putImage } = require('../services/neonObjectStorage');

const validId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const normalizeInput = (body) => ({
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
});

function validImage(file) {
    if (!file) return false;
    const bytes = file.buffer;
    if (file.mimetype === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (file.mimetype === 'image/png') return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (file.mimetype === 'image/webp') return bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    return false;
}

const imageKey = (file) => {
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype];
    return `categories/${randomUUID()}.${extension}`;
};

const toCategory = (row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    photo: getObjectUrl(row.image_key),
    is_active: true,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const listCategories = async (_req, res) => {
    try {
        const rows = await sql`SELECT id, name, description, image_key, created_at, updated_at FROM public.categories ORDER BY lower(name), id`;
        return res.json({ success: true, categories: rows.map(toCategory) });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to load categories.' });
    }
};

const getCategory = async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid category ID.' });
    try {
        const [row] = await sql`SELECT id, name, description, image_key, created_at, updated_at FROM public.categories WHERE id = ${req.params.id} LIMIT 1`;
        if (!row) return res.status(404).json({ success: false, message: 'Category not found.' });
        return res.json({ success: true, category: toCategory(row) });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to load category.' });
    }
};

const createCategory = async (req, res) => {
    const { name, description } = normalizeInput(req.body);
    if (!name || name.length > 120) return res.status(400).json({ success: false, message: 'Category name is required and must be at most 120 characters.' });
    if (description.length > 2000) return res.status(400).json({ success: false, message: 'Description must be at most 2000 characters.' });
    if (!validImage(req.file)) return res.status(400).json({ success: false, message: 'Upload one valid JPEG, PNG, or WebP image (maximum 5 MB).' });

    const key = imageKey(req.file);
    try {
        await putImage(key, req.file);
        const [row] = await sql`
            INSERT INTO public.categories (name, description, image_key)
            VALUES (${name}, ${description}, ${key})
            RETURNING id, name, description, image_key, created_at, updated_at
        `;
        return res.status(201).json({ success: true, category: toCategory(row) });
    } catch (error) {
        try { await deleteObject(key); } catch { /* Orphan cleanup can be retried from the bucket. */ }
        if (error.code === '23505') return res.status(409).json({ success: false, message: 'A category with this name already exists.' });
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to create category.' });
    }
};

const updateCategory = async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid category ID.' });
    const { name, description } = normalizeInput(req.body);
    if (!name || name.length > 120) return res.status(400).json({ success: false, message: 'Category name is required and must be at most 120 characters.' });
    if (description.length > 2000) return res.status(400).json({ success: false, message: 'Description must be at most 2000 characters.' });
    if (req.file && !validImage(req.file)) return res.status(400).json({ success: false, message: 'Upload one valid JPEG, PNG, or WebP image (maximum 5 MB).' });

    let oldKey;
    let newKey;
    try {
        const [current] = await sql`SELECT image_key FROM public.categories WHERE id = ${req.params.id} LIMIT 1`;
        if (!current) return res.status(404).json({ success: false, message: 'Category not found.' });
        oldKey = current.image_key;
        newKey = req.file ? imageKey(req.file) : req.body.removeImage === 'true' ? null : oldKey;
        if (!newKey) return res.status(400).json({ success: false, message: 'A category image is required.' });
        if (req.file) await putImage(newKey, req.file);

        const [row] = await sql`
            UPDATE public.categories SET name = ${name}, description = ${description}, image_key = ${newKey}, updated_at = now()
            WHERE id = ${req.params.id}
            RETURNING id, name, description, image_key, created_at, updated_at
        `;
        if (newKey !== oldKey) {
            try { await deleteObject(oldKey); } catch (error) { req.log?.warn?.(error); }
        }
        return res.json({ success: true, category: toCategory(row) });
    } catch (error) {
        if (newKey && newKey !== oldKey) {
            try { await deleteObject(newKey); } catch { /* Orphan cleanup can be retried from the bucket. */ }
        }
        console.error('[categories:update] failed', {
            categoryId: req.params.id,
            code: error.code,
            status: error.status,
            message: error.message,
        });
        if (error.code === '23505') return res.status(409).json({ success: false, message: 'A category with this name already exists.' });
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to update category.' });
    }
};

const deleteCategory = async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid category ID.' });
    try {
        const [row] = await sql`DELETE FROM public.categories WHERE id = ${req.params.id} RETURNING image_key`;
        if (!row) return res.status(404).json({ success: false, message: 'Category not found.' });
        try { await deleteObject(row.image_key); } catch (error) { console.error('Unable to delete category image from Neon Object Storage:', error.message); }
        return res.json({ success: true, message: 'Category deleted.' });
    } catch {
        return res.status(500).json({ success: false, message: 'Unable to delete category.' });
    }
};

module.exports = { listCategories, getCategory, createCategory, updateCategory, deleteCategory };
