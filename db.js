const Database = require('better-sqlite3');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const h = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}

function open(file = process.env.DB_FILE) {
  if (!file) {
    if (process.env.VERCEL) {
      file = '/tmp/webgis.db';
      const srcDb = path.join(__dirname, 'data', 'webgis.db');
      if (!fs.existsSync(file) && fs.existsSync(srcDb)) {
        fs.copyFileSync(srcDb, file);
      }
    } else {
      file = path.join(__dirname, 'data', 'webgis.db');
    }
  }
  if (process.argv.includes('--reset') && file.endsWith('webgis.db') && fs.existsSync(file)) fs.unlinkSync(file);
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  if (db.prepare('SELECT COUNT(*) c FROM lokasi').get().c === 0) {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'seed.json'), 'utf8'));
    const jenis = [...new Set(seed.map(s => s.jenis))];
    const insJ = db.prepare('INSERT INTO jenis_olahraga(nama_jenis) VALUES (?)');
    jenis.forEach(j => insJ.run(j));
    const idJ = Object.fromEntries(db.prepare('SELECT * FROM jenis_olahraga').all().map(r => [r.nama_jenis, r.id_jenis]));
    const ins = db.prepare(`INSERT INTO lokasi(kode,nama,id_jenis,latitude,longitude,alamat,kecamatan,jam,tarif,fasilitas,foto)
      VALUES (@kode,@nama,@id_jenis,@latitude,@longitude,@alamat,@kecamatan,@jam,@tarif,@fasilitas,@foto)`);
    db.transaction(() => seed.forEach(s => ins.run({ ...s, id_jenis: idJ[s.jenis] })))();
  }
  if (db.prepare('SELECT COUNT(*) c FROM admin').get().c === 0)
    db.prepare('INSERT INTO admin(username,password) VALUES (?,?)').run('admin', hashPassword(process.env.ADMIN_PASSWORD || 'admin123'));
  return db;
}
module.exports = { open, verifyPassword, hashPassword };
if (require.main === module) { const db = open(); console.log('Database siap:', db.prepare('SELECT COUNT(*) c FROM lokasi').get().c, 'lokasi'); }
