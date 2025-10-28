// src/db.js
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Ruta absoluta al archivo .db (se guardará en la raíz del proyecto)
const dbPath = path.join(__dirname, '../geeknews.db');

// Crear o abrir la base de datos
const db = new Database(dbPath);
console.log('✅ Conectado a la base de datos SQLite:', dbPath);

// Crear tabla usuarios
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Crear tabla de favoritos (ya la dejamos lista para después)
db.exec(`
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL,
  news_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, news_id)
);
`);

// Tabla de noticias
db.exec(`
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  section TEXT NOT NULL,        -- pokemon | starwars | lotr | medieval
  image_url TEXT,
  excerpt TEXT,                 -- resumen corto
  content TEXT,                 -- cuerpo largo
  published INTEGER DEFAULT 0,  -- 0 = borrador, 1 = publicado
  author_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(author_id) REFERENCES users(id)
);
`);

// Tabla de suscriptores (newsletter)
db.exec(`
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Campañas del newsletter
db.exec(`
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Logs de envíos (simulados)
db.exec(`
CREATE TABLE IF NOT EXISTS campaign_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  sent_to INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  preview_links_json TEXT, -- JSON con URLs de vista previa de Ethereal
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
);
`);


// Crear usuario administrador si no existe
const adminEmail = 'admin@geek.news';
const checkAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);

if (!checkAdmin) {
  const adminPass = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(adminEmail, adminPass, 'admin');
  console.log('👑 Usuario administrador creado: admin@geek.news / admin123');
}

module.exports = db;
