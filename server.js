const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs'), path = require('path');
const { open, verifyPassword } = require('./db');

function createApp(db) {
  const app = express();
  const sessions = new Map();               // token -> username
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  const SELECT = `SELECT l.id_lokasi AS id, l.kode, l.nama, j.nama_jenis AS jenis, l.id_jenis, l.latitude, l.longitude,
    l.alamat, l.kecamatan, l.jam, l.tarif, l.fasilitas, l.foto FROM lokasi l JOIN jenis_olahraga j USING(id_jenis)`;

  // ---------- validasi ----------
  function validate(b) {
    const err = [];
    const lat = Number(b.latitude), lng = Number(b.longitude);
    if (!b.nama || !String(b.nama).trim()) err.push('Nama wajib diisi');
    if (!Number.isInteger(Number(b.id_jenis)) || !db.prepare('SELECT 1 FROM jenis_olahraga WHERE id_jenis=?').get(b.id_jenis)) err.push('Jenis olahraga tidak valid');
    if (!Number.isFinite(lat) || lat > -0.6 || lat < -1.1) err.push('Latitude harus bernilai negatif dan berada di sekitar Kota Palu (-1,1 s.d. -0,6)');
    if (!Number.isFinite(lng) || lng < 119.7 || lng > 120.1) err.push('Longitude harus berada di sekitar Kota Palu (119,7 s.d. 120,1)');
    return err;
  }

  // ---------- publik ----------
  app.get('/api/jenis', (req, res) => res.json(db.prepare(
    'SELECT j.id_jenis, j.nama_jenis, COUNT(l.id_lokasi) jumlah FROM jenis_olahraga j LEFT JOIN lokasi l USING(id_jenis) GROUP BY j.id_jenis ORDER BY j.nama_jenis').all()));

  app.get('/api/lokasi', (req, res) => {
    const where = [], p = [];
    if (req.query.q) { where.push('(l.nama LIKE ? OR l.alamat LIKE ?)'); p.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    if (req.query.jenis) { where.push('l.id_jenis = ?'); p.push(Number(req.query.jenis)); }
    if (req.query.kecamatan) { where.push('l.kecamatan = ?'); p.push(req.query.kecamatan); }
    res.json(db.prepare(SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY l.kode').all(...p));
  });

  app.get('/api/lokasi/:id', (req, res) => {
    const r = db.prepare(SELECT + ' WHERE l.id_lokasi = ?').get(req.params.id);
    r ? res.json(r) : res.status(404).json({ error: 'Lokasi tidak ditemukan' });
  });

  const haversine = (a, b, c, d) => {
    const R = 6371, rad = x => x * Math.PI / 180, dLa = rad(c - a), dLo = rad(d - b);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  app.get('/api/terdekat', (req, res) => {
    const lat = Number(req.query.lat), lng = Number(req.query.lng), n = Math.min(Number(req.query.n) || 5, 30);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Parameter lat dan lng wajib angka' });
    let rows = db.prepare(SELECT).all().map(r => ({ ...r, jarak_km: +haversine(lat, lng, r.latitude, r.longitude).toFixed(2) }));
    if (req.query.jenis) rows = rows.filter(r => r.id_jenis === Number(req.query.jenis));
    res.json(rows.sort((a, b) => a.jarak_km - b.jarak_km).slice(0, n));
  });

  app.get('/api/statistik', (req, res) => res.json({
    total: db.prepare('SELECT COUNT(*) c FROM lokasi').get().c,
    per_kecamatan: db.prepare('SELECT kecamatan, COUNT(*) jumlah FROM lokasi GROUP BY kecamatan ORDER BY jumlah DESC').all(),
    per_jenis: db.prepare('SELECT j.nama_jenis, COUNT(*) jumlah FROM lokasi l JOIN jenis_olahraga j USING(id_jenis) GROUP BY j.id_jenis ORDER BY jumlah DESC').all()
  }));

  // layer garis & poligon dari ArcGIS (GeoJSON) -> public/geo/
  app.get('/api/layers', (req, res) => {
    res.json({ kecamatan: true, jalan: true });
  });

  // ---------- admin ----------
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const u = db.prepare('SELECT * FROM admin WHERE username=?').get(String(username || ''));
    if (!u || !verifyPassword(String(password || ''), u.password)) return res.status(401).json({ error: 'Username atau password salah' });
    const token = crypto.randomBytes(24).toString('hex'); sessions.set(token, u.username);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Strict`);
    res.json({ ok: true, username: u.username });
  });
  app.post('/api/logout', (req, res) => {
    const m = /sid=([a-f0-9]+)/.exec(req.headers.cookie || ''); if (m) sessions.delete(m[1]);
    res.setHeader('Set-Cookie', 'sid=; Max-Age=0; Path=/'); res.json({ ok: true });
  });
  function auth(req, res, next) {
    const m = /sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
    if (m && sessions.has(m[1])) return next();
    res.status(401).json({ error: 'Perlu login sebagai admin' });
  }
  app.get('/api/me', auth, (req, res) => res.json({ ok: true }));

  const upload = multer({
    storage: multer.diskStorage({
      destination: path.join(__dirname, 'public', 'foto'),
      filename: (req, f, cb) => cb(null, 'upload_' + Date.now() + path.extname(f.originalname).toLowerCase())
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, f, cb) => cb(null, /\.(jpe?g|png|webp)$/i.test(f.originalname))
  });

  const cols = ['kode', 'nama', 'id_jenis', 'latitude', 'longitude', 'alamat', 'kecamatan', 'jam', 'tarif', 'fasilitas', 'foto'];
  const clean = b => Object.fromEntries(cols.map(c => [c, b[c] === undefined || b[c] === '' ? null : b[c]]));

  app.post('/api/admin/lokasi', auth, upload.single('fotoFile'), (req, res) => {
    const b = { ...req.body }; if (req.file) b.foto = 'foto/' + req.file.filename;
    const err = validate(b); if (err.length) return res.status(400).json({ error: err.join('; ') });
    if (!b.kode) b.kode = 'FAS-' + String(db.prepare('SELECT COALESCE(MAX(id_lokasi),0)+1 n FROM lokasi').get().n).padStart(3, '0');
    try {
      const r = db.prepare(`INSERT INTO lokasi(${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(clean(b));
      res.status(201).json(db.prepare(SELECT + ' WHERE l.id_lokasi=?').get(r.lastInsertRowid));
    } catch (e) { res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Kode sudah dipakai' : 'Gagal menyimpan' }); }
  });
  app.put('/api/admin/lokasi/:id', auth, upload.single('fotoFile'), (req, res) => {
    const old = db.prepare('SELECT * FROM lokasi WHERE id_lokasi=?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Lokasi tidak ditemukan' });
    const b = { ...old, ...req.body }; if (req.file) b.foto = 'foto/' + req.file.filename;
    const err = validate(b); if (err.length) return res.status(400).json({ error: err.join('; ') });
    try {
      db.prepare(`UPDATE lokasi SET ${cols.map(c => c + '=@' + c).join(',')} WHERE id_lokasi=@id`).run({ ...clean(b), id: req.params.id });
      res.json(db.prepare(SELECT + ' WHERE l.id_lokasi=?').get(req.params.id));
    } catch (e) { res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Kode sudah dipakai' : 'Gagal menyimpan' }); }
  });
  app.delete('/api/admin/lokasi/:id', auth, (req, res) => {
    const r = db.prepare('DELETE FROM lokasi WHERE id_lokasi=?').run(req.params.id);
    r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Lokasi tidak ditemukan' });
  });
  return app;
}
module.exports = { createApp };
if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp(open()).listen(port, () => console.log(`WebGIS berjalan di http://localhost:${port}  (admin: http://localhost:${port}/admin.html)`));
}
