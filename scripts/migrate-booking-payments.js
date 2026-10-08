require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

async function main() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const migration = await fs.readFile(path.join(__dirname, '../migrations/006_booking_payments_tickets.sql'), 'utf8');
        await pool.query(migration);
        console.log('Booking payments and tickets schema is ready.');
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message || 'Booking payment migration failed.');
    process.exitCode = 1;
});
