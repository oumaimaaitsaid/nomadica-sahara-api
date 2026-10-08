require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

async function main() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        for (const file of ['003_catalog_products.sql', '005_remove_pricing_options.sql']) {
            const migration = await fs.readFile(path.join(__dirname, '../migrations', file), 'utf8');
            await pool.query(migration);
        }
        console.log('Catalog schema is ready in Neon. Existing catalog rows were preserved.');
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message || 'Catalog migration failed.');
    process.exitCode = 1;
});
