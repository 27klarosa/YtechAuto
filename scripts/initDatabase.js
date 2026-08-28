const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataFolderPath = path.resolve(__dirname, '../database');
if (!fs.existsSync(dataFolderPath)) {
    fs.mkdirSync(dataFolderPath, { recursive: true });
}

const dbPath = path.resolve(dataFolderPath, 'database.sqlite');
const initSqlPath = path.resolve(dataFolderPath, 'database.sql');

const sqlCommands = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT '',
    stat TEXT,
    resetToken TEXT
);`;

if (!fs.existsSync(initSqlPath)) {
    fs.writeFileSync(initSqlPath, sqlCommands.trim(), 'utf8');
    console.log('Created default database.sql');
} else {
    console.log('Found existing database.sql — leaving it intact.');
}

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error(`Failed to connect to database: ${err.message}`);
                return reject(err);
            }

            // Enable foreign key constraints (required for FOREIGN KEY constraints to be enforced)
            db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
                if (pragmaErr) {
                    console.error(`Failed to enable foreign keys: ${pragmaErr.message}`);
                    db.close();
                    return reject(pragmaErr);
                }

                const schemaSql = fs.existsSync(initSqlPath)
                    ? fs.readFileSync(initSqlPath, 'utf8')
                    : sqlCommands.trim();

                const normalizedSchemaSql = schemaSql
                    .replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
                    .trim();

                db.exec(normalizedSchemaSql, (schemaErr) => {
                    if (schemaErr) {
                        console.error(`Failed to initialize database schema: ${schemaErr.message}`);
                        db.close();
                        return reject(new Error(`Database initialization failed: ${schemaErr.message}`));
                    }

                    console.log('SQLite schema verified with foreign key constraints enabled.');
                    resolve(db);
                });
            });
        });
    });
}

module.exports = initializeDatabase;