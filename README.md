# Mesin Tetas Dashboard

Dashboard responsif untuk membaca suhu dan kelembapan serta mengirim perintah ke ESP32 melalui MQTT. Repositori ini berisi dashboard dan simulator, bukan firmware ESP32.

## Menjalankan dashboard

1. Siapkan Mosquitto di host yang sama dengan web. Browser menggunakan WebSocket di port `9001` dengan path `/mqtt`; ESP32 menggunakan MQTT TCP di port `1883`.
2. Jalankan server dari folder repositori:

```sh
python3 -m http.server 5555
```

3. Buka `http://localhost:5555` dari host, atau `http://<alamat-host>:5555` dari perangkat yang terhubung ke jaringan privat yang sama. Dashboard mengambil alamat broker dari hostname halaman. Jangan buka port web atau MQTT ke internet publik.

## Format MQTT

| Topik | Arah | Isi |
|---|---|---|
| `incubator/sensor/state` | ESP32 ke dashboard | JSON pembacaan dan status |
| `incubator/control/power` | Dashboard ke ESP32 | `on` atau `off` |
| `incubator/control/setpoint` | Dashboard ke ESP32 | Angka dalam °C, misalnya `37.5` |

```json
{"temp_c": 37.9, "humidity": 64, "power": true, "setpoint": 37.5}
```

Koneksi broker tidak berarti data alat tersedia. Tombol ON/OFF memerlukan pembacaan baru beserta status `power` (boolean). Kontrol target manual hanya aktif saat alat melaporkan OFF. Saat dinyalakan lewat dashboard, target bawaan yang dikirim adalah 37,5 °C. Jika lebih dari 15 detik tidak ada pembacaan baru, kontrol dikunci kembali.

Gunakan `mock_device.py` dengan paket `paho-mqtt` pada broker uji yang terpisah dari mesin asli: `python3 mock_device.py <alamat-broker-uji>`.

MQTT.js dan IBM Plex Sans disimpan bersama dashboard; lisensi masing-masing disertakan.
