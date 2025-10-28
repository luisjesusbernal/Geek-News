// server.js
const nodemailer = require('nodemailer');
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const fs = require('fs'); // <--- AÑADIDO

// Conexión a SQLite y tablas (admin seed) — ver src/db.js
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Crear carpetas necesarias si no existen (para Render / Deploy)
if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads', { recursive: true });

// ============================
//  Configuración base
// ============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'algo-largo-y-seguro',
  resave: false,
  saveUninitialized: false,
  // cookie: { maxAge: 1000 * 60 * 60 } // opcional: 1h
}));

// ============================
//  Favoritos en SQLite
// ============================

// Listar favoritos del usuario actual (ids)
app.get('/api/favorites', ensureAuth, (req, res) => {
  const userId = req.session.userId;
  const rows = db.prepare('SELECT news_id FROM favorites WHERE user_id = ?').all(userId);
  const ids = rows.map(r => r.news_id);
  res.json({ ok: true, items: ids });
});

// Toggle favorito (agrega o quita)
app.post('/api/favorites/:newsId', ensureAuth, (req, res) => {
  const userId = req.session.userId;
  const newsId = Number(req.params.newsId);
  if (!Number.isInteger(newsId) || newsId <= 0) {
    return res.status(400).json({ ok: false, msg: 'newsId inválido' });
  }

  const getStmt = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND news_id = ?');
  const exists = getStmt.get(userId, newsId);

  if (exists) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND news_id = ?').run(userId, newsId);
    const rows = db.prepare('SELECT news_id FROM favorites WHERE user_id = ?').all(userId);
    return res.json({ ok: true, action: 'removed', items: rows.map(r => r.news_id) });
  } else {
    db.prepare('INSERT INTO favorites (user_id, news_id) VALUES (?, ?)').run(userId, newsId);
    const rows = db.prepare('SELECT news_id FROM favorites WHERE user_id = ?').all(userId);
    return res.json({ ok: true, action: 'added', items: rows.map(r => r.news_id) });
  }
});



// ============================
//  Helpers / Middlewares
// ============================
function ensureAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).send('No autorizado. Inicia sesión en /login.html');
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  return res.status(403).json({ ok: false, msg: 'Solo admin' });
}

// ============================
//  Rutas API (Usuarios en SQLite)
// ============================

// Registro (persistente)
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, confirm } = req.body || {};

    if (!email || !password || !confirm)
      return res.status(400).json({ ok: false, msg: 'Completa todos los campos' });
    if (!email.includes('@'))
      return res.status(400).json({ ok: false, msg: 'Correo inválido' });
    if (password.length < 4)
      return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 4 caracteres' });
    if (password !== confirm)
      return res.status(400).json({ ok: false, msg: 'Las contraseñas no coinciden' });

    const key = email.toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(key);
    if (existing) {
      return res.status(409).json({ ok: false, msg: 'Ese correo ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(key, passwordHash, 'user');

    return res.status(201).json({ ok: true, msg: 'Registro exitoso' });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// Login (persistente)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ ok: false, msg: 'Faltan datos' });

    const key = email.toLowerCase();
    const user = db.prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?').get(key);

    if (!user)
      return res.status(401).json({ ok: false, msg: 'Usuario o contraseña inválidos' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok)
      return res.status(401).json({ ok: false, msg: 'Usuario o contraseña inválidos' });

    // Guardar sesión
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;

    return res.json({ ok: true, msg: 'Login exitoso' });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// Estado de sesión (para nav.js)
app.get('/api/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      loggedIn: true,
      email: req.session.email,
      userId: req.session.userId,
      role: req.session.role || 'user',
    });
  }
  return res.json({ loggedIn: false });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true, msg: 'Sesión cerrada' }));
});

// ============================
//  Newsletter
// ============================

// Suscribirse (público)
app.post('/api/subscribe', (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ ok:false, msg:'Correo inválido' });
  }
  try {
    db.prepare('INSERT INTO subscriptions (email) VALUES (?)').run(email.toLowerCase().trim());
    return res.status(201).json({ ok:true, msg:'¡Gracias por suscribirte!' });
  } catch (e) {
    // Si ya existe (UNIQUE), devolvemos 409 amigable
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ ok:false, msg:'Ese correo ya está suscrito' });
    }
    console.error('SUBSCRIBE ERROR:', e);
    return res.status(500).json({ ok:false, msg:'Error del servidor' });
  }
});

// ============================
//  Newsletter - Listado admin
// ============================
app.get('/api/admin/subscribers', ensureAdmin, (req, res) => {
  const lim = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db.prepare(`
    SELECT id, email, created_at
    FROM subscriptions
    ORDER BY id DESC
    LIMIT ?
  `).all(lim);
  res.json({ ok:true, items: rows });
});

// Eliminar suscriptor
app.delete('/api/admin/subscribers/:id', ensureAdmin, (req, res) => {
  const sql = `DELETE FROM subscriptions WHERE id = ?`;
  try {
    const stmt = db.prepare(sql);
    stmt.run(req.params.id);
    res.json({ ok: true, msg: "Suscriptor eliminado" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: "Error al eliminar suscriptor" });
  }
});


// ============================
//  Favoritos 
// ============================

// Listar favoritos del usuario actual
app.get('/api/favorites', ensureAuth, (req, res) => {
  const userId = req.session.userId;
  const set = favorites.get(userId) || new Set();
  res.json({ ok: true, items: Array.from(set) });
});

// Toggle favorito
app.post('/api/favorites/:newsId', ensureAuth, (req, res) => {
  const userId = req.session.userId;
  const newsId = Number(req.params.newsId);
  if (!Number.isInteger(newsId) || newsId <= 0) {
    return res.status(400).json({ ok: false, msg: 'newsId inválido' });
  }

  let set = favorites.get(userId);
  if (!set) {
    set = new Set();
    favorites.set(userId, set);
  }

  if (set.has(newsId)) {
    set.delete(newsId);
    return res.json({ ok: true, action: 'removed', items: Array.from(set) });
  } else {
    set.add(newsId);
    return res.json({ ok: true, action: 'added', items: Array.from(set) });
  }
});

// Listar noticias para admin (todos los estados)
app.get('/api/admin/news', ensureAdmin, (req, res) => {
  const lim = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db.prepare(`
    SELECT id, title, section, image_url, excerpt, published, created_at
    FROM news
    ORDER BY id DESC
    LIMIT ?
  `).all(lim);
  res.json({ ok: true, items: rows });
});

// Eliminar noticia (y limpiar favoritos asociados)
app.delete('/api/news/:id', ensureAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok:false, msg:'ID inválido' });
  }

  // borrar favoritos asociados para no dejar huérfanos
  db.prepare('DELETE FROM favorites WHERE news_id = ?').run(id);
  const info = db.prepare('DELETE FROM news WHERE id = ?').run(id);

  if (info.changes === 0) {
    return res.status(404).json({ ok:false, msg:'Noticia no encontrada' });
  }
  return res.json({ ok:true, msg:'Noticia eliminada', id });
});


// ============================
//  Noticias (SQLite)
// ============================

// Crear noticia (solo admin)
app.post('/api/news', ensureAdmin, (req, res) => {
  const { title, section, image_url, excerpt, content, published } = req.body || {};

  if (!title || !section) {
    return res.status(400).json({ ok:false, msg:'Título y sección son obligatorios' });
  }
  const allowed = new Set(['pokemon','starwars','lotr','medieval']);
  if (!allowed.has(section)) {
    return res.status(400).json({ ok:false, msg:'Sección inválida' });
  }

  const stmt = db.prepare(`
    INSERT INTO news (title, section, image_url, excerpt, content, published, author_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    title.trim(),
    section,
    image_url?.trim() || null,
    excerpt?.trim() || null,
    content?.trim() || null,
    published ? 1 : 0,
    req.session.userId
  );

  return res.status(201).json({ ok:true, id: info.lastInsertRowid });
});

// Listar noticias publicadas (público)
// ?section=pokemon&limit=20
app.get('/api/news', (req, res) => {
  const { section, limit } = req.query;
  const lim = Math.min(Number(limit) || 20, 100);
  if (section) {
    const rows = db.prepare(`
      SELECT id, title, section, image_url, excerpt, created_at
      FROM news
      WHERE published = 1 AND section = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(section, lim);
    return res.json({ ok:true, items: rows });
  } else {
    const rows = db.prepare(`
      SELECT id, title, section, image_url, excerpt, created_at
      FROM news
      WHERE published = 1
      ORDER BY id DESC
      LIMIT ?
    `).all(lim);
    return res.json({ ok:true, items: rows });
  }
});

// Detalle de noticia (público, si está publicada o si el autor/admin la ve, opcional simple: solo publicadas)
app.get('/api/news/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`
    SELECT id, title, section, image_url, excerpt, content, published, created_at
    FROM news WHERE id = ? AND published = 1
  `).get(id);
  if (!row) return res.status(404).json({ ok:false, msg:'Noticia no encontrada' });
  return res.json({ ok:true, item: row });
});

const multer = require('multer');

// Configuración de almacenamiento para imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
  filename: (req, file, cb) => {
    // Nombre único: timestamp + nombre “sanitizado”
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});

// Filtro: solo imágenes
function imageFilter(req, file, cb) {
  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido (solo imágenes).'));
}

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Subir imagen (solo admin)
app.post('/api/upload-image', ensureAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok:false, msg:'No se recibió archivo' });
  // Ruta pública para usar en <img src="...">
  const publicUrl = '/uploads/' + req.file.filename;
  res.status(201).json({ ok:true, url: publicUrl });
});

// ============================
//  Campañas (ADMIN)
//  Requiere: ensureAdmin, db (con tablas campaigns y campaign_logs ya creadas)
// ============================

// Crear campaña
app.post('/api/admin/campaigns', ensureAdmin, (req, res) => {
  const { subject, body } = req.body || {};
  if (!subject || !body) {
    return res.status(400).json({ ok:false, msg:'Asunto y cuerpo son obligatorios' });
  }
  try {
    const info = db.prepare('INSERT INTO campaigns (subject, body) VALUES (?, ?)').run(subject.trim(), body.trim());
    return res.status(201).json({ ok:true, id: info.lastInsertRowid });
  } catch (e) {
    console.error('CREATE CAMPAIGN ERROR:', e);
    return res.status(500).json({ ok:false, msg:'Error al crear campaña' });
  }
});

// Listar campañas
app.get('/api/admin/campaigns', ensureAdmin, (req, res) => {
  try {
    const lim = Math.min(Number(req.query.limit) || 50, 200);
    const rows = db.prepare(`
      SELECT id, subject, body, created_at
      FROM campaigns
      ORDER BY id DESC
      LIMIT ?
    `).all(lim);
    return res.json({ ok:true, items: rows });
  } catch (e) {
    console.error('LIST CAMPAIGNS ERROR:', e);
    return res.status(500).json({ ok:false, msg:'Error al listar campañas' });
  }
});

// Enviar campaña (versión rápida en paralelo con Ethereal)
app.post('/api/admin/campaigns/:id/send', ensureAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const camp = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (!camp) return res.status(404).json({ ok:false, msg:'Campaña no encontrada' });

  const subs = db.prepare('SELECT email FROM subscriptions ORDER BY id DESC').all();
  const emails = subs.map(s => s.email);
  const total = emails.length;
  if (total === 0) return res.status(400).json({ ok:false, msg:'No hay suscriptores para enviar' });

  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });

    const results = await Promise.allSettled(
      emails.map(to => transporter.sendMail({
        from: '"Geek News" <no-reply@geek.news>',
        to,
        subject: camp.subject,
        text: camp.body,
        html: `<div style="font-family:system-ui,Arial,sans-serif;">
                 <h2>${escapeHtml(camp.subject)}</h2>
                 <div>${camp.body.replace(/\n/g,'<br>')}</div>
               </div>`
      }))
    );

    let success = 0;
    const previewLinks = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        success++;
        const url = nodemailer.getTestMessageUrl(r.value);
        if (url) previewLinks.push(url);
      }
    }

    const infoLog = db.prepare(`
      INSERT INTO campaign_logs (campaign_id, sent_to, success_count, preview_links_json)
      VALUES (?, ?, ?, ?)
    `).run(id, total, success, JSON.stringify(previewLinks));

    return res.json({
      ok: true,
      msg: 'Envío (simulado) completado',
      sent_to: total,
      success_count: success,
      preview_links: previewLinks,
      log_id: infoLog.lastInsertRowid
    });

  } catch (err) {
    console.error('SEND CAMPAIGN ERROR:', err);
    return res.status(500).json({ ok:false, msg:'Error al enviar campaña' });
  }
});

// util para plantilla
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}





// ============================
//  Estáticos y vistas
// ============================
app.use(express.static(path.join(__dirname, 'public')));

// Página protegida de ejemplo (si decides usarla)
app.get('/panel', ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

// Páginas públicas
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (_, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (_, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));

// ============================
//  Start
// ============================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
