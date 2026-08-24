const Database = require("better-sqlite3");

const db = new Database("career_route_map.db");

db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        education TEXT,
        field_of_study TEXT,
        experience_level TEXT,
        career_goal TEXT,
        skills TEXT,
        interests TEXT,
        career_preference TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

console.log("Database connected successfully.");

module.exports = db;
