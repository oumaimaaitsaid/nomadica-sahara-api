require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to connect to Neon.');
}

const sql = neon(databaseUrl);

module.exports = sql;
