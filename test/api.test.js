// Pengujian black box otomatis (jalankan: npm test)
const test = require('node:test'), assert = require('node:assert');
const os = require('os'), path = require('path');
process.env.DB_FILE = path.join(os.tmpdir(), 'webgis-test-' + Date.now() + '.db');
const { open } = require('../db'); const { createApp } = require('../server');
let server, base, cookie = '';
const api = (p, o = {}) => fetch(base + p, { ...o, headers: { 'Content-Type': 'application/json', cookie, ...(o.headers || {}) } });
test.before(async () => { server = createApp(open()).listen(0); base = 'http://localhost:' + server.address().port; });
test.after(() => server.close());

test('TC-01 daftar lokasi memuat 30 titik', async () => { const r = await (await api('/api/lokasi')).json(); assert.equal(r.length, 30); });
test('TC-02 pencarian nama yang ada', async () => { const r = await (await api('/api/lokasi?q=padel')).json(); assert.ok(r.length >= 4 && r.every(x => /padel/i.test(x.nama + x.alamat))); });
test('TC-03 pencarian nama tidak ada -> kosong', async () => { const r = await (await api('/api/lokasi?q=zzzxxx')).json(); assert.equal(r.length, 0); });
test('TC-04 filter jenis olahraga', async () => {
  const j = (await (await api('/api/jenis')).json()).find(x => x.nama_jenis === 'Futsal');
  const r = await (await api('/api/lokasi?jenis=' + j.id_jenis)).json();
  assert.equal(r.length, 2); assert.ok(r.every(x => x.jenis === 'Futsal'));
});
test('TC-05 detail lokasi memuat koordinat dan foto hotlink', async () => {
  const r = await (await api('/api/lokasi/1')).json();
  assert.ok(r.latitude < 0 && r.longitude > 119 && r.foto.startsWith('foto/'));
  assert.equal((await fetch(base + '/' + r.foto)).status, 200);
});
test('TC-06 lokasi terdekat terurut menurut jarak', async () => {
  const r = await (await api('/api/terdekat?lat=-0.8935&lng=119.8891&n=3')).json();
  assert.equal(r.length, 3); assert.ok(r[0].jarak_km <= r[1].jarak_km && r[1].jarak_km <= r[2].jarak_km);
});
test('TC-07 terdekat tanpa koordinat -> 400', async () => { assert.equal((await api('/api/terdekat')).status, 400); });
test('TC-08 pengguna publik tidak boleh menambah data', async () => {
  const r = await api('/api/admin/lokasi', { method: 'POST', body: JSON.stringify({ nama: 'X' }) }); assert.equal(r.status, 401);
});
test('TC-09 login salah ditolak', async () => {
  const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'salah' }) }); assert.equal(r.status, 401);
});
test('TC-10 login admin benar', async () => {
  const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  assert.equal(r.status, 200); cookie = r.headers.get('set-cookie').split(';')[0];
});
let newId;
test('TC-11 admin menambah lokasi', async () => {
  const r = await api('/api/admin/lokasi', { method: 'POST', body: JSON.stringify({ nama: 'Lapangan Uji', id_jenis: 1, latitude: -0.9, longitude: 119.87, kecamatan: 'Palu Barat' }) });
  assert.equal(r.status, 201); newId = (await r.json()).id; assert.equal((await (await api('/api/lokasi')).json()).length, 31);
});
test('TC-12 validasi koordinat di luar Kota Palu / lintang positif ditolak', async () => {
  const r = await api('/api/admin/lokasi', { method: 'POST', body: JSON.stringify({ nama: 'Salah', id_jenis: 1, latitude: 0.9, longitude: 119.87 }) });
  assert.equal(r.status, 400);
});
test('TC-13 admin mengubah lokasi', async () => {
  const r = await api('/api/admin/lokasi/' + newId, { method: 'PUT', body: JSON.stringify({ nama: 'Lapangan Uji Ubah' }) });
  assert.equal(r.status, 200); assert.equal((await r.json()).nama, 'Lapangan Uji Ubah');
});
test('TC-14 admin menghapus lokasi', async () => {
  assert.equal((await api('/api/admin/lokasi/' + newId, { method: 'DELETE' })).status, 200);
  assert.equal((await (await api('/api/lokasi')).json()).length, 30);
});
