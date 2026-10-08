require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const productRoutes = require('./src/routes/productRoutes');
const { getAuth } = require('./src/config/betterAuth');

const app = express();

// Middlewares
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));

// Better Auth owns its request parsing and must run before express.json().
app.all('/API/V1/auth/*splat', async (req, res, next) => {
    try {
        const [{ toNodeHandler }, auth] = await Promise.all([
            import('better-auth/node'),
            getAuth(),
        ]);
        return toNodeHandler(auth)(req, res, next);
    } catch (error) {
        return next(error);
    }
});

app.use(express.json());

// Routes mapping
app.use('/API/V1', authRoutes);
app.use('/API/V1/categories', categoryRoutes);
app.use('/API/V1/products', productRoutes);

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
