-- Skema basisdata WebGIS Fasilitas Olahraga Kota Palu (SQLite)
CREATE TABLE IF NOT EXISTS jenis_olahraga (
  id_jenis    INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_jenis  TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS lokasi (
  id_lokasi   INTEGER PRIMARY KEY AUTOINCREMENT,
  kode        TEXT NOT NULL UNIQUE,            -- contoh FAS-001
  nama        TEXT NOT NULL,
  id_jenis    INTEGER NOT NULL REFERENCES jenis_olahraga(id_jenis),
  latitude    REAL NOT NULL CHECK (latitude < 0),   -- Lintang Selatan
  longitude   REAL NOT NULL,                        -- Bujur Timur
  alamat      TEXT,
  kecamatan   TEXT,
  jam         TEXT,
  tarif       TEXT,
  fasilitas   TEXT,
  foto        TEXT                                -- hotlink: foto/fas_01_id_futsal.png
);
CREATE TABLE IF NOT EXISTS admin (
  id_admin    INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL                        -- hash scrypt (salt:hash)
);
