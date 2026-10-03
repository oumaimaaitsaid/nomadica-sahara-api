const { z } = require('zod');

const normalizeEmail = (value) => value.trim().toLowerCase();

const loginPartnerSchema = z.object({
    email: z.string()
        .trim()
        .transform(normalizeEmail)
        .pipe(z.string().email({ message: 'Invalid email address' })),
    password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

const registerPartnerSchema = z.object({
    firstName: z.string().trim().min(2, { message: 'First name is required' }),
    lastName: z.string().trim().min(2, { message: 'Last name is required' }),
    email: z.string()
        .trim()
        .transform(normalizeEmail)
        .pipe(z.string().email({ message: 'Invalid email address' })),
    password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

module.exports = { loginPartnerSchema, registerPartnerSchema };