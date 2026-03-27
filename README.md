# CryptoNews Mobile MVP

Bu proje, Telegram'dan girilen kripto son dakika haberlerini mobil uygulamaya ve Twitter (X) hesabina bildirim/gonderi olarak tasimak icin hazirlandi.

Bu surumde ek olarak:

- Retry destekli yayin kuyrugu
- Admin key ile guvenli manuel haber yayinlama endpoint'i
- Telegram icin alan-bazli (structured) mesaj formati
- Temel API guvenligi (helmet + rate limit)
- Son 45 dakika icinde duplicate haber engelleme
- Mobilde watchlist ve hizli fiyat alarmi

## Ozellikler

- Telegram webhook ile haber alimi
- Gelen haberi:
  - mobil kullanicilara push notification olarak gonderme
  - Twitter hesabinda otomatik paylasma
- Mobil uygulamada:
  - Son dakika haber listesi
  - Top coin fiyatlari ve 24 saat degisimleri
  - Coin detay/proje bilgisi (CoinGecko)
  - Watchlist (favori coin listesi)
  - Hedef fiyat alarmi (+%5 / -%5 hizli alarm)
  - BTC dominans, Fear & Greed, toplam market cap
- Modern ve canli bir UI

## Klasorler

- `backend`: Express API + Telegram webhook + push + Twitter otomasyonu
- `mobile`: Expo React Native uygulamasi

## 1) Backend Kurulumu

```bash
cd backend
npm install
copy .env.example .env
```

`.env` icine asagidakileri gir:

- `TELEGRAM_WEBHOOK_SECRET`: Telegram webhook secret token
- `TELEGRAM_ALLOWED_CHAT_ID`: Sadece belirli kanal/gruptan haber kabul etmek icin (opsiyonel)
- `TWITTER_APP_KEY`, `TWITTER_APP_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
- `ADMIN_API_KEY`: Admin endpointleri icin zorunlu gizli anahtar
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`: API rate limit ayarlari

Backend'i calistir:

```bash
npm run dev
```

API varsayilan olarak `http://localhost:4000` adresinde acilir.

## 2) Telegram Webhook Baglama

Yerelde test icin public URL gerekir (ngrok veya cloud sunucu).

Webhook endpoint:

- `POST /webhook/telegram/news`

Telegram setWebhook ornek:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<PUBLIC_URL>/webhook/telegram/news&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

### Haber formati (Telegram mesaji)

Ilk satir baslik, diger satirlar aciklama olabilir:

```text
Bitcoin ETF tarafinda yeni gelisme
SEC kaynakli iddialar piyasa volatilitesini artirdi.
#BTC
#ETF
```

Structured format da desteklenir:

```text
Baslik: Ethereum staking tarafinda yeni gelisme
Metin: ETF beklentisi ile ETH dominansi yukseliyor.
Onem: high
Coin: ETH, LDO
Etiket: #ETH #STAKING #ETF
```

`Onem` alaninda `normal`, `high`, `urgent` kullanabilirsin.

## 3) Mobil Kurulum

```bash
cd mobile
npm install
```

API adresi icin iki yontemden biri:

- `app.json` icindeki `expo.extra.apiBaseUrl` degerini degistir
- veya environment ile `EXPO_PUBLIC_API_BASE_URL` ver

Calistir:

```bash
npm start
```

### Watchlist ve Alarm

- Fiyatlar sekmesinde coin yanindaki yildiz ile watchlist'e ekleyebilirsin.
- Coin detayinda `+%5 Ust Alarm` veya `-%5 Alt Alarm` butonlari ile hizli alarm kurulur.
- Alarm tetiklenince cihazda lokal bildirim gorunur ve alarm listeden cikar.

## 4) Admin Uzerinden Haber Yayinlama

Admin endpoint:

- `POST /api/news/publish`

Header:

- `x-admin-key: <ADMIN_API_KEY>`

Body ornegi:

```json
{
  "title": "FED aciklamasi sonrasi piyasa hareketlendi",
  "body": "BTC ve altcoinlerde volatilite yukseliyor.",
  "priority": "high",
  "tags": ["#BTC", "#MACRO"],
  "coins": ["BTC", "ETH"]
}
```

Queue operasyon endpoint:

- `GET /api/ops/queue` (admin key gerekir)

## 5) TestFlight Hazirlik ve Gonderim (Expo EAS)

`mobile` klasorunde:

```bash
npm install
npx eas login
npx eas init
```

`app.json` icinde iOS bundle ID tanimli:

- `com.bora.cryptonews`

Build al:

```bash
npm run build:ios:testflight
```

Build tamamlaninca submit et:

```bash
npm run submit:ios:testflight
```

Not:

- `mobile/eas.json` dosyasinda `submit.production` altindaki `appleId`, `ascAppId`, `appleTeamId` alanlarini kendi Apple gelistirici bilgilerinle doldur.
- App Store Connect icinde TestFlight testeri ekleyip build'i review'a gonderebilirsin.

## Onemli Notlar

- iOS simulator push token vermez; fiziksel cihazda test et.
- Twitter API anahtarlari yoksa backend Twitter gonderimini otomatik olarak `skip` eder.
- Coin proje bilgisi CoinGecko API'dan gelir.
- Mobilde coin kartlarinda 7 gunluk mini trend (sparkline bars) gorunur.
- Duplicate haberler (son 45 dakika, baslik+metin eslesmesi) otomatik reddedilir.

## Sonraki Gelistirme Adimlari

- Admin paneli ile manuel haber girisi
- Redis queue ile daha guvenli notification dagitimi
- MongoDB/PostgreSQL ile kalici veri modeli
- Cihaz bazli bildirim tercihleri (kategoriye gore)
- Kullanici auth ve rol bazli yetkilendirme
