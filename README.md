# WebGIS Pemetaan Lapangan dan Fasilitas Olahraga Kota Palu
Tugas Proyek Rekayasa Perangkat Lunak (Kelas C) dan SIG, Kelompok 8.

## Fitur
- Peta publik (Leaflet + OpenStreetMap) dengan 30 marker hasil survei
- Pencarian nama/alamat, filter jenis olahraga, popup alamat, jam, tarif, fasilitas, dan foto (hotlink)
- Lapangan terdekat dari lokasi pengguna (geolokasi + rumus Haversine)
- Layer poligon (batas kecamatan) dan garis (jalan) dari ArcGIS, format GeoJSON (lihat di bawah)
- Admin: login, tambah, ubah, hapus lokasi (CRUD), klik peta untuk mengisi koordinat, unggah foto

## Cara menjalankan
Prasyarat: Node.js 18 atau lebih baru.

    npm install
    npm start

Buka http://localhost:3000 (peta) dan http://localhost:3000/admin.html (admin).
Akun awal: username `admin`, password `admin123`. Untuk mengganti: hapus `data/webgis.db`, lalu jalankan
`ADMIN_PASSWORD=passwordbaru npm start` (Windows PowerShell: `$env:ADMIN_PASSWORD="passwordbaru"; npm start`).

Pengujian otomatis (14 skenario black box): `npm test`
Reset database ke 30 titik awal: `npm run seed`

## Layer garis dan poligon dari ArcGIS
Ekspor layer batas kecamatan dan jaringan jalan ke GeoJSON (ArcGIS Pro: Conversion Tools > JSON > Features To JSON,
centang GeoJSON, sistem koordinat WGS 1984), lalu simpan sebagai:

    public/geo/kecamatan.geojson
    public/geo/jalan.geojson

Setelah file ada, kotak layer di panel kiri peta otomatis aktif. Atribut nama kecamatan dibaca dari
`nama_kecamatan`, `NAMA`, atau `name`.

## Struktur
    server.js          server Express + REST API
    db.js, schema.sql  basisdata SQLite (jenis_olahraga, lokasi, admin) dan seed
    data/seed.json     data 30 titik dari laporan SIG
    public/            antarmuka (index.html, admin.html, foto/, geo/)
    test/api.test.js   pengujian otomatis

## Endpoint utama
    GET  /api/lokasi?q=&jenis=&kecamatan=    GET /api/lokasi/:id
    GET  /api/terdekat?lat=&lng=&n=          GET /api/jenis    GET /api/statistik
    POST /api/login   POST /api/logout
    POST /api/admin/lokasi   PUT/DELETE /api/admin/lokasi/:id   (perlu login)
