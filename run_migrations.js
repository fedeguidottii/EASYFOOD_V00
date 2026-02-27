import { Client } from 'pg';
import fs from 'fs';

const runMigrations = async () => {
    const client = new Client({
        connectionString: "postgresql://postgres:Viafermi20!@db.iqilquhkwjrbwxydsphr.supabase.co:5432/postgres" // Using standard postgres user and provided password
    });

    try {
        await client.connect();
        console.log("Connected to Supabase DB");

        const sql = fs.readFileSync('EASYFOOD_MIGRATIONS.sql', 'utf8');
        console.log("Reading SQL file, executing...");

        await client.query(sql);
        console.log("SUCCESS! All migrations executed.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
};

runMigrations();
