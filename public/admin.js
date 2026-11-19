const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = ['kode', 'nama', 'id_jenis', 'kecamatan', 'latitude', 'longitude', 'alamat', 'jam', 'tarif', 'fasilitas', 'foto'];
let editId = null, data = [], pick, pm;
const msg = (el, t, ok) => { $(el).innerHTML = t ? `<div class="msg ${ok ? 'ok' : 'er'}">${esc(t)}</div>` : ''; };

async function start() {
  const ok = (await fetch('/api/me')).ok; $('loginBox').style.display = ok ? 'none' : ''; $('panel').style.display = ok ? '' : 'none'; if (ok) refresh();
}
async function refresh() {
  const jenis = await (await fetch('/api/jenis')).json(); $('id_jenis').innerHTML = jenis.map(j => `<option value="${j.id_jenis}">${esc(j.nama_jenis)}</option>`).join('');
  data = await (await fetch('/api/lokasi')).json(); $('cnt').textContent = data.length;
  $('rows').innerHTML = data.map(r => `<tr><td>${esc(r.kode)}</td><td>${esc(r.nama)}</td><td>${esc(r.jenis)}</td><td>${esc(r.kecamatan)}</td>
   <td><button class="sec" data-e="${r.id}">Ubah</button> <button class="del" data-d="${r.id}">Hapus</button></td></tr>`).join('');
}
$('btnLogin').onclick = async () => {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('u').value, password: $('p').value }) });
  r.ok ? start() : msg('loginMsg', (await r.json()).error, false);
};
$('btnOut').onclick = async () => { await fetch('/api/logout', { method: 'POST' }); location.reload(); };
function openForm(r) {
  editId = r ? r.id : null; $('fTitle').textContent = r ? 'Ubah Lokasi ' + r.kode : 'Tambah Lokasi'; msg('fMsg', '');
  F.forEach(f => $(f).value = r ? (r[f] ?? '') : ''); $('fotoFile').value = ''; $('formCard').style.display = '';
  if (!pick) { pick = L.map('pick').setView([-0.9, 119.87], 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(pick);
    pick.on('click', e => { $('latitude').value = e.latlng.lat.toFixed(7); $('longitude').value = e.latlng.lng.toFixed(7); mark(); }); }
  setTimeout(() => { pick.invalidateSize(); mark(); }, 50);
}
function mark() { if (pm) pick.removeLayer(pm); const a = parseFloat($('latitude').value), b = parseFloat($('longitude').value); if (!isNaN(a) && !isNaN(b)) { pm = L.marker([a, b]).addTo(pick); pick.setView([a, b], 15); } }
$('btnNew').onclick = () => openForm(null); $('btnCancel').onclick = () => $('formCard').style.display = 'none';
$('rows').onclick = async e => {
  if (e.target.dataset.e) openForm(data.find(x => x.id == e.target.dataset.e));
  if (e.target.dataset.d && confirm('Hapus lokasi ini?')) { await fetch('/api/admin/lokasi/' + e.target.dataset.d, { method: 'DELETE' }); refresh(); }
};
$('btnSave').onclick = async () => {
  const fd = new FormData(); F.forEach(f => fd.append(f, $(f).value)); if ($('fotoFile').files[0]) fd.append('fotoFile', $('fotoFile').files[0]);
  const r = await fetch(editId ? '/api/admin/lokasi/' + editId : '/api/admin/lokasi', { method: editId ? 'PUT' : 'POST', body: fd });
  const j = await r.json(); if (r.ok) { msg('fMsg', 'Data berhasil disimpan', true); refresh(); editId = j.id; } else msg('fMsg', j.error, false);
};
start();
