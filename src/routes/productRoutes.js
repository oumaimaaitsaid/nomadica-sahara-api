const express = require('express');
const { listPublicProducts, getPublicProduct } = require('../controllers/productController');

const router = express.Router();

router.get('/', listPublicProducts);
router.get('/:slug', getPublicProduct);

module.exports = router;
