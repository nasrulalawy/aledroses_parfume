# Kebijakan Migrasi Database (Production)

**Tanggal kesepakatan:** 2025-02-14  
**Status:** Production — data tidak boleh hilang karena migration.

## Kesepakatan

Mulai sekarang, **tidak boleh ada data yang terhapus** ketika melakukan:

- `supabase db push`
- Menjalankan migration SQL (file di `supabase/migrations/`)
- Deploy atau update schema ke database production

Setiap migration harus **hanya menambah atau mengubah struktur** dengan cara yang aman, tanpa menghapus data user/transaksi/outlet dll.

## Prinsip

| Boleh | Tidak boleh |
|-------|-------------|
| `ADD COLUMN IF NOT EXISTS` | `DROP COLUMN` |
| `CREATE INDEX IF NOT EXISTS` | `DROP TABLE` |
| `CREATE OR REPLACE FUNCTION` | `DELETE FROM ...` di migration |
| `DROP POLICY` + `CREATE POLICY` (RLS) | `TRUNCATE` |
| Tambah nilai enum dengan pengecekan | Hapus data untuk “merapikan” schema |

## Alasan

- Database sudah dipakai production.
- Kehilangan data (transaksi, outlet, karyawan, dll) tidak dapat diterima.
- Perubahan schema harus **additive** (tambah/ubah), bukan **destructive** (hapus data/kolom/tabel).

## Untuk developer / AI

Saat menulis migration baru:

1. Gunakan pola aman: `IF NOT EXISTS`, `OR REPLACE`, dll.
2. Jangan masukkan `DROP TABLE`, `DROP COLUMN`, `DELETE FROM tabel`, atau `TRUNCATE` ke file migration.
3. Aturan Cursor untuk migrasi: `.cursor/rules/migrations-production.mdc` (otomatis dipakai untuk file di `supabase/migrations/`).

Jika suatu saat benar-benar perlu menghapus kolom/tabel (sangat jarang), harus ada:

- Backup data,
- Kesepakatan tim,
- Dan dilakukan di luar migration rutin (prosedur khusus).
