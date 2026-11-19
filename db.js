let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = null;
}
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

function createMemoryDb() {
  const seedPath = path.join(__dirname, 'data', 'seed.json');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  let jenisList = [...new Set(seed.map(s => s.jenis))].map((nama, idx) => ({
    id_jenis: idx + 1,
    nama_jenis: nama
  }));
  let jenisMap = Object.fromEntries(jenisList.map(j => [j.nama_jenis, j.id_jenis]));

  let lokasiList = seed.map((s, idx) => ({
    id_lokasi: idx + 1,
    id: idx + 1,
    kode: s.kode || `FAS-${String(idx + 1).padStart(3, '0')}`,
    nama: s.nama,
    id_jenis: jenisMap[s.jenis],
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    alamat: s.alamat || null,
    kecamatan: s.kecamatan || null,
    jam: s.jam || null,
    tarif: s.tarif || null,
    fasilitas: s.fasilitas || null,
    foto: s.foto || null
  }));

  let adminList = [
    { id_admin: 1, username: 'admin', password: hashPassword(process.env.ADMIN_PASSWORD || 'admin123') }
  ];

  function getFullRows() {
    return lokasiList.map(l => {
      const j = jenisList.find(x => x.id_jenis === l.id_jenis);
      return {
        ...l,
        id: l.id_lokasi,
        jenis: j ? j.nama_jenis : ''
      };
    });
  }

  return {
    pragma: () => {},
    exec: () => {},
    transaction: fn => fn,
    prepare(sql) {
      const s = sql.trim().replace(/\s+/g, ' ');
      return {
        all(...args) {
          if (s.includes('FROM jenis_olahraga') && s.includes('COUNT(l.id_lokasi)')) {
            return jenisList.map(j => ({
              id_jenis: j.id_jenis,
              nama_jenis: j.nama_jenis,
              jumlah: lokasiList.filter(l => l.id_jenis === j.id_jenis).length
            })).sort((a, b) => a.nama_jenis.localeCompare(b.nama_jenis));
          }
          if (s.includes('FROM lokasi l JOIN jenis_olahraga j')) {
            let rows = getFullRows();
            if (s.includes('WHERE')) {
              let pIdx = 0;
              if (s.includes('nama LIKE') || s.includes('alamat LIKE')) {
                const q = String(args[pIdx++] || '').replace(/%/g, '').toLowerCase();
                pIdx++;
                rows = rows.filter(r => (r.nama + ' ' + (r.alamat || '')).toLowerCase().includes(q));
              }
              if (s.includes('l.id_jenis = ?')) {
                const jid = Number(args[pIdx++]);
                rows = rows.filter(r => r.id_jenis === jid);
              }
              if (s.includes('l.kecamatan = ?')) {
                const kec = args[pIdx++];
                rows = rows.filter(r => r.kecamatan === kec);
              }
            }
            return rows.sort((a, b) => a.kode.localeCompare(b.kode));
          }
          if (s.includes('FROM lokasi GROUP BY kecamatan')) {
            const counts = {};
            lokasiList.forEach(l => { if (l.kecamatan) counts[l.kecamatan] = (counts[l.kecamatan] || 0) + 1; });
            return Object.entries(counts).map(([kecamatan, jumlah]) => ({ kecamatan, jumlah })).sort((a, b) => b.jumlah - a.jumlah);
          }
          if (s.includes('FROM lokasi l JOIN jenis_olahraga j USING(id_jenis) GROUP BY j.id_jenis')) {
            const counts = {};
            lokasiList.forEach(l => {
              const j = jenisList.find(x => x.id_jenis === l.id_jenis);
              if (j) counts[j.nama_jenis] = (counts[j.nama_jenis] || 0) + 1;
            });
            return Object.entries(counts).map(([nama_jenis, jumlah]) => ({ nama_jenis, jumlah })).sort((a, b) => b.jumlah - a.jumlah);
          }
          if (s.includes('SELECT * FROM jenis_olahraga')) {
            return [...jenisList];
          }
          return [];
        },
        get(...args) {
          if (s.includes('SELECT 1 FROM jenis_olahraga WHERE id_jenis=?')) {
            return jenisList.find(j => j.id_jenis === Number(args[0])) ? { 1: 1 } : undefined;
          }
          if (s.includes('SELECT COUNT(*) c FROM lokasi')) {
            return { c: lokasiList.length };
          }
          if (s.includes('SELECT COUNT(*) c FROM admin')) {
            return { c: adminList.length };
          }
          if (s.includes('SELECT * FROM admin WHERE username=?')) {
            return adminList.find(a => a.username === args[0]);
          }
          if (s.includes('WHERE l.id_lokasi = ?') || s.includes('WHERE l.id_lokasi=?')) {
            return getFullRows().find(r => r.id_lokasi === Number(args[0]));
          }
          if (s.includes('SELECT * FROM lokasi WHERE id_lokasi=?')) {
            return lokasiList.find(r => r.id_lokasi === Number(args[0]));
          }
          if (s.includes('MAX(id_lokasi)')) {
            const max = lokasiList.reduce((m, r) => Math.max(m, r.id_lokasi), 0);
            return { n: max + 1 };
          }
          return undefined;
        },
        run(params) {
          if (s.startsWith('INSERT INTO jenis_olahraga')) {
            const id = jenisList.length + 1;
            jenisList.push({ id_jenis: id, nama_jenis: params });
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.startsWith('INSERT INTO admin')) {
            const id = adminList.length + 1;
            adminList.push({ id_admin: id, username: params[0], password: params[1] });
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.startsWith('INSERT INTO lokasi')) {
            const id = lokasiList.reduce((m, r) => Math.max(m, r.id_lokasi), 0) + 1;
            const item = {
              id_lokasi: id,
              id: id,
              kode: params.kode,
              nama: params.nama,
              id_jenis: Number(params.id_jenis),
              latitude: Number(params.latitude),
              longitude: Number(params.longitude),
              alamat: params.alamat || null,
              kecamatan: params.kecamatan || null,
              jam: params.jam || null,
              tarif: params.tarif || null,
              fasilitas: params.fasilitas || null,
              foto: params.foto || null
            };
            lokasiList.push(item);
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.startsWith('UPDATE lokasi')) {
            const idx = lokasiList.findIndex(r => r.id_lokasi === Number(params.id));
            if (idx >= 0) {
              lokasiList[idx] = {
                ...lokasiList[idx],
                ...params,
                id_lokasi: Number(params.id),
                id: Number(params.id),
                id_jenis: Number(params.id_jenis || lokasiList[idx].id_jenis),
                latitude: Number(params.latitude || lokasiList[idx].latitude),
                longitude: Number(params.longitude || lokasiList[idx].longitude)
              };
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          if (s.startsWith('DELETE FROM lokasi')) {
            const prevLen = lokasiList.length;
            lokasiList = lokasiList.filter(r => r.id_lokasi !== Number(params));
            return { changes: prevLen - lokasiList.length };
          }
          return { changes: 0 };
        }
      };
    }
  };
}

function open(file = process.env.DB_FILE) {
  // If on Vercel or if Database module is not available, use the memory database
  if (process.env.VERCEL || !Database) {
    return createMemoryDb();
  }
  if (!file) file = path.join(__dirname, 'data', 'webgis.db');
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
