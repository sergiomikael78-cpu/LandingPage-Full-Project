# LATOTO PC - Ultra Modern Screenshot Logger

Aplikasi Python dengan GUI ultra modern untuk mengambil screenshot otomatis dan mengirimkannya ke Discord webhook. Semua fitur tersedia dalam satu interface yang sangat keren dan dinamis.

## 🎯 Fitur Utama

- 🖥️ **Ultra Modern GUI**: Interface dengan desain ultra modern, keren, dan dinamis
- 📸 **Screenshot Otomatis**: Mengambil screenshot setiap interval yang dapat dikonfigurasi
- 🔄 **ALT+TAB Detection**: Screenshot saat ALT+TAB ditekan
- 📱 **Discord Integration**: Kirim screenshot langsung ke Discord webhook
- 🎛️ **Real-time Control**: Start/Stop service dari GUI
- 📊 **Live Monitoring**: Lihat status service dan jumlah screenshot terkirim
- 📝 **Log Viewer**: Lihat log aktivitas dalam GUI
- 🧪 **Webhook Testing**: Test koneksi Discord webhook
- ⚙️ **Easy Configuration**: Setup webhook dan pengaturan dengan mudah
- 🚫 **No Console**: Berjalan tanpa command prompt
- 🎨 **Ultra Modern Design**: Warna kontras, efek hover, animasi smooth
- 🔄 **Background Service**: Service tetap berjalan di background meskipun GUI ditutup
- 💾 **Service Persistence**: Status service dan screenshot count tersimpan
- 🎯 **Smart Closing**: Opsi untuk stop service atau biarkan tetap berjalan saat tutup GUI

## 📁 File yang Diperlukan

- `latotopc_modern.py` - Aplikasi GUI ultra modern (direkomendasikan)
- `start_modern.bat` - Menjalankan versi ultra modern
- `uninstall.bat` - Uninstall aplikasi

## 🚀 Cara Penggunaan

### 1. Menjalankan Aplikasi

```bash
# Double click file ini untuk tampilan ultra modern
start_modern.bat
```

### 2. Setup Awal
1. **Tab "⚙️ Setup & Control"**:
   - Masukkan Discord webhook URL
   - Atur interval screenshot (1-60 detik)
   - Aktifkan/nonaktifkan ALT+TAB detection
   - Aktifkan/nonaktifkan auto restart
   - Klik "💾 Save Settings"

### 3. Test Webhook
- Klik tombol "🧪 Test Webhook" untuk memastikan koneksi Discord berfungsi
- Pesan test akan dikirim ke channel Discord

### 4. Start Service
- Klik tombol "🚀 Start Service" untuk memulai screenshot otomatis
- Status akan berubah menjadi "🟢 Running"
- Counter screenshot akan mulai menghitung
- **Service akan tetap berjalan di background meskipun GUI ditutup**

### 5. Monitor Aktivitas
- **Tab "📋 Logs"**: Lihat log aktivitas real-time
- **Status Bar**: Lihat status service dan jumlah screenshot terkirim
- **Service Status**: Monitor apakah service sedang berjalan
- **Background Monitoring**: Service tetap aktif meskipun GUI tidak terbuka

### 6. Stop Service
- Klik tombol "⏹️ Stop Service" untuk menghentikan screenshot otomatis
- Status akan berubah menjadi "⏸️ Stopped"
- **Service hanya berhenti ketika di-stop secara eksplisit**

### 7. Smart GUI Closing
- **Ketika GUI ditutup**: Muncul dialog dengan 3 opsi:
  - **Yes**: Stop service dan tutup GUI
  - **No**: Biarkan service tetap berjalan di background dan tutup GUI
  - **Cancel**: Batal tutup, GUI tetap terbuka
- **Service Persistence**: Jika dipilih "No", service akan tetap berjalan tanpa GUI

## 🖥️ Interface GUI Ultra Modern

### Tab 1: ⚙️ Setup & Control
- **🔗 Discord Webhook**: Input webhook URL dengan styling modern
- **⚙️ Settings**: Konfigurasi interval, ALT+TAB, auto restart
- **🎮 Control**: Tombol Start/Stop service, Save Settings, Test Webhook
- **📊 Service Status**: Status service dan counter screenshot

### Tab 2: 🕑 History
- **History List**: Daftar aktivitas screenshot dengan styling modern
- **🔄 Refresh/🗑️ Clear**: Update atau hapus history

### Tab 3: 📋 Logs
- **Log Viewer**: Tampilkan log aktivitas dengan font monospace
- **🔄 Refresh/🗑️ Clear**: Update atau hapus log

## 📋 Struktur Folder

```
LATOTO PC/
├── latotopc_modern.py    # 🆕 Aplikasi GUI ultra modern (direkomendasikan)
├── start_modern.bat      # 🆕 Menjalankan versi ultra modern
├── uninstall.bat         # Uninstall aplikasi
├── config.json           # Konfigurasi (auto-generated)
├── latotopc.log          # Log file (auto-generated)
└── README.md             # Dokumentasi ini
```

## 🔄 Background Service Features

### Service Persistence
- **Status Tracking**: Service status disimpan di `service_status.txt`
- **Screenshot Counter**: Jumlah screenshot tersimpan di `screenshot_count.txt`
- **Auto Recovery**: Jika GUI dibuka ulang, status service akan dikenali otomatis
- **Non-Daemon Threads**: Thread service tidak berhenti ketika GUI ditutup

### Background Operation
- **Continuous Monitoring**: Service tetap aktif meskipun GUI ditutup
- **No GUI Dependency**: Screenshot dan pengiriman ke Discord tetap berjalan
- **Memory Efficient**: Service berjalan dengan minimal resource usage
- **File-based Communication**: Service menggunakan file untuk komunikasi dengan GUI

### Smart Control
- **Explicit Stop Only**: Service hanya berhenti ketika tombol Stop ditekan atau file status dihapus
- **GUI Independence**: GUI dapat ditutup tanpa mempengaruhi service
- **Reopen GUI**: Buka ulang GUI untuk monitor status dan kontrol service
- **Manual Control**: Dapat dihentikan dengan menghapus `service_status.txt`

### File Management
- **service_status.txt**: Menyimpan status "running" atau kosong
- **screenshot_count.txt**: Menyimpan jumlah screenshot terkirim
- **Auto Cleanup**: File status dihapus otomatis saat service di-stop
- **Independent Loading**: Service membaca konfigurasi langsung dari file

## 🔧 Cara Kerja

1. **GUI Setup**: Masukkan webhook URL dan konfigurasi melalui interface ultra modern
2. **Service Control**: Start/Stop service dari GUI dengan efek visual
3. **Screenshot**: Ambil screenshot setiap interval dan saat ALT+TAB
4. **Send**: Kirim langsung ke Discord webhook (tidak disimpan lokal)
5. **Monitor**: Lihat status dan log dalam GUI real-time dengan styling modern

## 🛠️ Troubleshooting

### Error: Python not found
- Install Python dari https://www.python.org/downloads/
- Pastikan Python ada di PATH

### Error: Module not found
- Jalankan `start_modern.bat` untuk install dependencies otomatis

### Screenshot tidak terkirim
- Periksa Discord webhook URL di tab Setup
- Klik "🧪 Test Webhook" untuk memastikan koneksi
- Periksa koneksi internet
- Lihat log di tab Logs

### GUI tidak muncul
- Pastikan Python terinstall dengan benar
- Jalankan `python latotopc_modern.py` langsung untuk melihat error

### Service tidak start
- Pastikan webhook URL sudah diisi dan valid
- Klik "💾 Save Settings" sebelum start service
- Periksa log untuk error detail

### Service tetap berjalan di background
- Ini adalah fitur normal - service dirancang untuk tetap berjalan
- Buka ulang GUI untuk monitor dan kontrol service
- Klik "⏹️ Stop Service" untuk menghentikan service

### Console window muncul
- Gunakan `start_modern.bat` untuk versi ultra modern tanpa console

### GUI tidak dapat diakses service yang sedang berjalan
- Service berjalan independen dari GUI
- Buka ulang aplikasi untuk monitor status
- Service akan tetap aktif meskipun GUI ditutup

## 🔒 Keamanan

- Screenshot dikirim langsung ke Discord, tidak disimpan lokal
- Webhook URL disimpan di `config.json` lokal
- Log aktivitas disimpan di `latotopc.log`
- Tidak ada data yang dikirim ke server pihak ketiga

## 📦 Dependencies

- `pygetwindow` - Window management
- `requests` - HTTP requests untuk Discord
- `mss` - Screenshot capture
- `Pillow` - Image processing
- `keyboard` - Keyboard monitoring
- `tkinter` - GUI (built-in Python)

## 🎯 Keunggulan Ultra Modern Version

- **🎨 Ultra Modern Design**: Tampilan yang sangat keren dan modern
- **🌈 High Contrast**: Warna yang kontras dan mudah dibaca
- **✨ Smooth Animations**: Efek transisi yang halus
- **🎯 User-friendly**: Interface yang sangat mudah digunakan
- **📱 Responsive**: Layout yang menyesuaikan ukuran window
- **🔧 Real-time**: Monitor status dan log secara real-time
- **⚡ Flexible**: Konfigurasi interval dan fitur yang fleksibel
- **🔒 Secure**: Tidak menyimpan screenshot lokal
- **🚀 Efficient**: Semua fitur dalam satu aplikasi
- **🛡️ Reliable**: Auto restart dan error handling
- **🚫 Silent**: Berjalan tanpa console window

## 📞 Support

Jika ada masalah:
1. Periksa tab Logs untuk error detail
2. Test webhook untuk memastikan koneksi
3. Pastikan semua dependencies terinstall
4. Restart aplikasi jika diperlukan
5. Gunakan `start_modern.bat` untuk tampilan terbaik

## 📄 Lisensi

Free to use for personal and educational purposes. 