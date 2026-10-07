require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

async function main() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const migration = await fs.readFile(path.join(__dirname, '../migrations/001_better_auth.sql'), 'utf8');
        await pool.query(migration);
        console.log('Better Auth tables are ready in Neon.');
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message || 'Better Auth migration failed.');
    process.exitCode = 1;
});
