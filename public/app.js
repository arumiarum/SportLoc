/* Peta Olahraga Palu - antarmuka publik.
   Data dari API: /api/lokasi, /api/jenis, /api/terdekat, /api/layers */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PALETTE = ['#1f7a4d', '#d9531e', '#2b6cb0', '#b8860b', '#8e3b6e', '#0f8b8d', '#a23b2a', '#556b2f', '#5a5f9e', '#7b5e3b'];

// ---------- state ----------
const S = { all: [], jenis: [], color: {}, q: '', jenisId: null, kec: '', az: false, near: null, selId: null };
const markers = {};            // id -> L.marker

// ---------- peta ----------
const map = L.map('map', { zoomControl: false }).setView([-0.9, 119.87], 13);
L.control.zoom({ position: 'bottomright' }).addTo(map);
const base = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
  sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' })
};
base.osm.addTo(map);
const cluster = L.markerClusterGroup({
  showCoverageOnHover: false, maxClusterRadius: 42,
  iconCreateFunction: c => L.divIcon({ html: `<div class="cl" style="width:38px;height:38px">${c.getChildCount()}</div>`, className: '', iconSize: [38, 38] })
}).addTo(map);

const numOf = r => parseInt(String(r.kode).replace(/\D/g, ''), 10) || r.id;
const icon = (r, cls = '') => L.divIcon({ className: '', iconSize: [32, 41], iconAnchor: [16, 41],
  html: `<div class="mk ${cls}" style="--c:${S.color[r.id_jenis]}"><span>${numOf(r)}</span></div>` });

// ---------- tampil ----------
function filtered(ignoreKec = false) {
  const q = S.q.toLowerCase();
  return S.all.filter(r => (!S.jenisId || r.id_jenis === S.jenisId) && (ignoreKec || !S.kec || r.kecamatan === S.kec) &&
    (!q || (r.nama + ' ' + (r.alamat || '') + ' ' + (r.kecamatan || '')).toLowerCase().includes(q)));
}
function countTo(el, to) {
  const from = parseInt(el.textContent) || 0; if (from === to) return; const t0 = performance.now();
  (function f(t) { const p = Math.min((t - t0) / 350, 1); el.textContent = Math.round(from + (to - from) * p); if (p < 1) requestAnimationFrame(f); })(t0);
}
function render() {
  let rows = filtered();
  if (S.near) rows = rows.map(r => ({ ...r, km: S.near.find(n => n.id === r.id)?.jarak_km })).filter(r => r.km !== undefined).sort((a, b) => a.km - b.km);
  else if (S.az) rows = [...rows].sort((a, b) => a.nama.localeCompare(b.nama));
  // marker
  cluster.clearLayers(); Object.keys(markers).forEach(k => delete markers[k]);
  rows.forEach(r => {
    const m = L.marker([r.latitude, r.longitude], { icon: icon(r, r.id === S.selId ? 'sel' : ''), title: r.nama });
    m.on('click', () => select(r.id)); markers[r.id] = m; cluster.addLayer(m);
  });
  // daftar
  const list = $('list'); list.innerHTML = '';
  if (!rows.length) list.innerHTML = '<div class="empty"><b>Tidak ada hasil</b>Coba kata kunci lain atau tekan Reset.</div>';
  rows.forEach(r => {
    const el = document.createElement('div'); el.className = 'item' + (r.id === S.selId ? ' act' : ''); el.dataset.id = r.id; el.style.setProperty('--c', S.color[r.id_jenis]);
    el.innerHTML = `<span class="num">${numOf(r)}</span><div><b>${esc(r.nama)}</b><small>${esc(r.jenis)} &middot; ${esc(r.kecamatan)}</small></div>${r.km !== undefined ? `<span class="km">${r.km} km</span>` : ''}`;
    el.onclick = () => select(r.id);
    el.onmouseenter = () => markers[r.id]?.getElement()?.firstChild?.classList.add('hl');
    el.onmouseleave = () => markers[r.id]?.getElement()?.firstChild?.classList.remove('hl');
    list.appendChild(el);
  });
  $('resText').textContent = S.near ? `5 lokasi terdekat dari posisi Anda` : `${rows.length} dari ${S.all.length} lokasi`;
  $('sortBtn').style.display = S.near ? 'none' : ''; $('sortBtn').textContent = S.az ? 'Urut nomor' : 'Urut A-Z';
  countTo($('sTampil'), rows.length); countTo($('sJenis'), new Set(rows.map(r => r.id_jenis)).size); countTo($('sKec'), new Set(rows.map(r => r.kecamatan)).size);
  chips(); bars();
  if (rows.length && (S.q || S.jenisId || S.kec || S.near)) map.flyToBounds(L.latLngBounds(rows.map(r => [r.latitude, r.longitude])).pad(.25), { maxZoom: 16, duration: .7 });
}
function chips() {
  const base = S.all.filter(r => (!S.kec || r.kecamatan === S.kec) && (!S.q || (r.nama + ' ' + (r.alamat || '')).toLowerCase().includes(S.q.toLowerCase())));
  const box = $('chips'); box.innerHTML = '';
  const mk = (id, label, n, c) => { const e = document.createElement('span'); e.className = 'chip' + (S.jenisId === id ? ' on' : '') + (n === 0 ? ' dim' : ''); if (c) e.style.setProperty('--c', c);
    e.innerHTML = (c ? '<i></i>' : '') + esc(label) + ` <em>${n}</em>`; e.onclick = () => { S.jenisId = S.jenisId === id ? null : id; S.near = null; render(); }; box.appendChild(e); };
  mk(null, 'Semua', base.length, null); box.firstChild.className = 'chip' + (S.jenisId === null ? ' on' : ''); box.firstChild.onclick = () => { S.jenisId = null; S.near = null; render(); };
  S.jenis.forEach(j => mk(j.id_jenis, j.nama_jenis, base.filter(r => r.id_jenis === j.id_jenis).length, S.color[j.id_jenis]));
}
function bars() {
  const rows = filtered(true), cnt = {}; rows.forEach(r => cnt[r.kecamatan] = (cnt[r.kecamatan] || 0) + 1);
  const arr = Object.entries(cnt).sort((a, b) => b[1] - a[1]), max = arr.length ? arr[0][1] : 1;
  $('bars').innerHTML = arr.length ? arr.map(([k, v]) => `<div class="bar${S.kec === k ? ' on' : ''}" data-k="${esc(k)}"><span>${esc(k)}</span><div><b style="width:${v / max * 100}%"></b></div><em>${v}</em></div>`).join('') : '<div class="empty">Tidak ada data</div>';
  document.querySelectorAll('.bar').forEach(b => b.onclick = () => { S.kec = S.kec === b.dataset.k ? '' : b.dataset.k; $('kec').value = S.kec; S.near = null; render(); });
}

// ---------- pilih lokasi / detail ----------
function select(id) {
  const r = S.all.find(x => x.id === id); if (!r) return;
  const prev = S.selId; S.selId = id;
  if (prev && markers[prev]) markers[prev].setIcon(icon(S.all.find(x => x.id === prev)));
  if (markers[id]) { cluster.zoomToShowLayer(markers[id], () => markers[id].setIcon(icon(r, 'sel'))); }
  map.flyTo([r.latitude, r.longitude], Math.max(map.getZoom(), 16), { duration: .8 });
  document.querySelectorAll('.item').forEach(e => e.classList.toggle('act', +e.dataset.id === id));
  const act = document.querySelector('.item.act'); if (act) act.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const c = S.color[r.id_jenis];
  $('detail').style.setProperty('--c', c);
  $('dPh').style.backgroundImage = r.foto ? `url("${encodeURI(r.foto)}")` : 'none';
  $('dTag').textContent = r.jenis; $('dTag').style.setProperty('--c', c); $('dPh').style.setProperty('--c', c);
  $('dNama').textContent = r.nama; $('dKode').textContent = `${r.kode} \u00b7 ${r.kecamatan || ''}`;
  const near = S.near && S.near.find(n => n.id === id);
  $('dInfo').innerHTML = [['Alamat', r.alamat], ['Jam', r.jam], ['Tarif', r.tarif], ['Fasilitas', r.fasilitas], ['Koordinat', `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`], near ? ['Jarak', near.jarak_km + ' km dari Anda'] : null]
    .filter(x => x && x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  $('dRute').href = `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`;
  $('dCopy').onclick = () => navigator.clipboard.writeText(`${r.latitude}, ${r.longitude}`).then(() => toast('Koordinat disalin'));
  $('detail').classList.add('open');
}
$('dX').onclick = () => { $('detail').classList.remove('open'); if (S.selId && markers[S.selId]) markers[S.selId].setIcon(icon(S.all.find(x => x.id === S.selId))); S.selId = null; document.querySelectorAll('.item.act').forEach(e => e.classList.remove('act')); };
function toast(t) { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 1800); }

// ---------- kontrol ----------
$('q').addEventListener('input', e => { S.q = e.target.value.trim(); S.near = null; render(); });
$('qClear').onclick = () => { $('q').value = ''; S.q = ''; render(); };
$('kec').onchange = e => { S.kec = e.target.value; S.near = null; render(); };
$('sortBtn').onclick = () => { S.az = !S.az; render(); };
$('reset').onclick = () => { S.q = ''; S.jenisId = null; S.kec = ''; S.az = false; S.near = null; $('q').value = ''; $('kec').value = ''; $('dX').click(); render(); fitAll(); };
$('fitbtn').onclick = fitAll;
function fitAll() { map.flyToBounds(L.latLngBounds(S.all.map(r => [r.latitude, r.longitude])).pad(.1), { duration: .8 }); }
$('near').onclick = () => {
  if (!navigator.geolocation) return toast('Peramban tidak mendukung geolokasi');
  $('near').textContent = 'Mencari lokasi...';
  navigator.geolocation.getCurrentPosition(async pos => {
    const p = new URLSearchParams({ lat: pos.coords.latitude, lng: pos.coords.longitude, n: 5 }); if (S.jenisId) p.set('jenis', S.jenisId);
    S.near = await (await fetch('/api/terdekat?' + p)).json();
    L.circleMarker([pos.coords.latitude, pos.coords.longitude], { radius: 8, color: '#fff', weight: 3, fillColor: '#2b6cb0', fillOpacity: 1 }).addTo(map).bindTooltip('Posisi Anda');
    $('near').textContent = 'Terdekat dari saya'; render();
  }, () => { $('near').textContent = 'Terdekat dari saya'; toast('Izin lokasi ditolak atau tidak tersedia'); }, { timeout: 10000 });
};
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t)); $('paneList').hidden = t.dataset.tab !== 'list'; $('paneStat').hidden = t.dataset.tab !== 'stat'; });
document.querySelectorAll('#basebox button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#basebox button').forEach(x => x.classList.toggle('on', x === b));
  Object.values(base).forEach(l => map.removeLayer(l)); base[b.dataset.b].addTo(map).bringToBack();
});

// ---------- layer garis dan poligon (GeoJSON dari ArcGIS) ----------
async function layers() {
  const ly = await (await fetch('/api/layers')).json(), L_ = {};
  [['lyKec', 'lyKecL', 'kecamatan', { color: '#7a4f9a', weight: 2, dashArray: '6 4', fillOpacity: .06 }], ['lyJln', 'lyJlnL', 'jalan', { color: '#b08b3a', weight: 3 }]].forEach(([id, lab, f, st]) => {
    const cb = $(id); if (!ly[f]) { $(lab).classList.add('off'); $(lab).title = `Belum ada file public/geo/${f}.geojson`; return; }
    cb.disabled = false;
    cb.onchange = async () => {
      if (cb.checked) { if (!L_[f]) L_[f] = L.geoJSON(await (await fetch(`/geo/${f}.geojson`)).json(), { style: st, onEachFeature: (ft, l) => { const n = ft.properties && (ft.properties.nama_kecamatan || ft.properties.NAMA || ft.properties.name); if (n) l.bindTooltip(String(n), { sticky: true }); } }); L_[f].addTo(map).bringToBack(); }
      else map.removeLayer(L_[f]);
    };
  });
}

// ---------- mulai ----------
(async function init() {
  const [all, jenis] = await Promise.all([fetch('/api/lokasi').then(r => r.json()), fetch('/api/jenis').then(r => r.json())]);
  S.all = all; S.jenis = jenis.filter(j => j.jumlah > 0); S.jenis.forEach((j, i) => S.color[j.id_jenis] = PALETTE[i % PALETTE.length]);
  const kecs = [...new Set(all.map(r => r.kecamatan).filter(Boolean))].sort();
  $('kec').innerHTML = '<option value="">Semua kecamatan</option>' + kecs.map(k => `<option>${esc(k)}</option>`).join('');
  $('legBox').innerHTML = S.jenis.map(j => `<div class="lg" style="--c:${S.color[j.id_jenis]}"><i></i>${esc(j.nama_jenis)}</div>`).join('');
  // tampilan awal: pusat kota (median titik), bukan seluruh batas, agar titik tidak menumpuk
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  if (all.length) map.setView([med(all.map(r => r.latitude)), med(all.map(r => r.longitude))], 13);
  render(); layers();
})();
