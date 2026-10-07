const express = require('express');
const multer = require('multer');
const { verifyToken, requirePartner } = require('../middlewares/authMiddleware');
const {
    listCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
} = require('../controllers/categoryController');

const router = express.Router();
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
        const accepted = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        callback(accepted ? null : new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'), accepted);
    },
}).single('image');

const parseCategoryImage = (req, res, next) => imageUpload(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
        success: false,
        message: tooLarge ? 'Image must be 5 MB or smaller.' : 'Upload one JPEG, PNG, or WebP image.',
    });
});

router.use(verifyToken, requirePartner);
router.get('/', listCategories);
router.get('/:id', getCategory);
router.post('/', parseCategoryImage, createCategory);
router.put('/:id', parseCategoryImage, updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
