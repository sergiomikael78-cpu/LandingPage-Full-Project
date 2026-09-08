# Rencana Implementasi - Kunci Pengaman Scatter (Safety Lock 100%)

Kita akan memperbaiki kesalahan penginputan scatter (misal: masuk 4 padahal target 3) dengan menerapkan verifikasi teks ganda dan mengaktifkan kembali Safety Lock sebelum data disimpan.

## Proyeksi Perubahan

### [Komponen] bonussmb-content.js

#### [MODIFY] [bonussmb-content.js](file:///c:/Users/IT/OneDrive/Desktop/LANDINGPAGE-FULL-PROJECT/EXTENSION-SCATTER-SMJ/otoscatter/bonussmb-content.js)

1.  **Penyempurnaan `fillScatterByVisualIndex`**:
    - **Pencarian Teks Utama**: Sistem akan memprioritaskan klik pada opsi yang secara fisik mengandung teks "3", "4", atau "5".
    - **Indeks sebagai Cadangan**: Pemetaan `0=3, 1=4, 2=5` hanya digunakan jika pencarian teks gagal.
    - **Filter Placeholder Ketat**: Memastikan tulisan "Pilih..." benar-benar hilang dari daftar hitungan indeks.
2.  **Re-Aktivasi Safety Lock di `fillTicket`**:
    - Sebelum perintah `saveBtn.click()` dieksekusi, sistem akan melakukan **Verifikasi Akhir**.
    - Jika angka yang terbaca di kotak scatter tidak cocok dengan target, sistem akan membatalkan proses dan mengirim error `Input Mismatch`.

## Efek untuk User
- **Keamanan Data**: Sistem tidak akan pernah mengeklik "Simpan" jika angka scatter yang terpilih salah.
- **Laporan Akurat**: Jika terjadi kesalahan, status di dashboard Anda akan berubah menjadi "Input Mismatch (Safety Lock)" sehingga Anda bisa langsung me-retry manual dengan aman.

## Rencana Verifikasi

### Verifikasi Manual
1.  Jalankan transaksi dengan scatter 3.
2.  Pantau log: Cari pesan `[SCATTER] ✅ VERIFIED`.
3.  Pastikan tombol Simpan hanya diklik jika verifikasi sukses.
