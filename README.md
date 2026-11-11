# Nota Öğren

Sol anahtarında nota okumayı adım adım öğreten web uygulaması (bağlama öğrencileri için).

**Uygulama:** https://erdinc1911.github.io/nota-ogren/

- Seviyeler 0–10: temel bilgi → Sol/La → … → diyez/bemol → koma sesleri
- Her seviyede Öğren / Alıştır / Sınav; sesle ya da dokunarak cevap
- Derleme gerektirmez: saf HTML + ES modülleri

## Dosyalar
- `js/lessons.js` – seviyeler ve ders içeriği
- `js/staff.js` – porte çizimi, `js/theory.js` – nota modeli ve sesli cevap ayrıştırma
- `js/speech.js` – ses tanıma (cihazda Vosk + yedekler), `model/` – Türkçe Vosk modeli, `js/audio.js` – ses, `js/store.js` – ilerleme, `js/app.js` – ekranlar
- `sap/` – bağlama sapı modülleri (şimdilik kullanılmıyor)

## Ses tanıma
GitHub Pages sürümünde konuşma cihazda tanınır (Vosk, WebAssembly): Brave dahil her tarayıcıda çalışır, yalnızca nota sözcüklerini dinler. İlk kullanımda ~35 MB model indirilir.
