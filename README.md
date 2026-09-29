# Foam Oracle

A mobile app that reads the foam on your beer the way a tea-leaf reader reads a cup. Photograph your glass and the oracle tells you how the next 12 hours of your life will go.

For entertainment only.

## How it works

1. **The app** (`mobile/`, Expo / React Native for iOS and Android) takes a photo and uploads it to the server.
2. **The server** (`server/`, Node + TypeScript) re-encodes the photo and strips its location metadata. If this device sent the same photo in the last 12 hours, the server returns the reading it gave then and doesn't call Claude again.
3. Otherwise the server sends the photo to **Claude** (`claude-opus-5-5`), which in a single call:
   - checks it's a real photo, not a picture of a screen,
   - finds every glass and decides whether each one really holds beer, with a confidence score (it's told to watch for cider, soda, root beer, kombucha, lattes and other lookalikes),
   - describes each glass's foam (head, bubbles, density, lacing, shapes),
   - writes a separate 12-hour reading for each beer, tying every prediction to a feature of that glass's foam.
4. The server enforces the rules itself as well: a glass gets a reading only if Claude marks it as beer with at least **80%** confidence (`BEER_CONFIDENCE_THRESHOLD` in `server/src/schema.ts`).

The API key stays on the server and is never shipped inside the app.

## Running it

You need Node 20+ and an [Anthropic API key](https://console.anthropic.com/).

**Server**

```bash
cd server
npm install
cp .env.example .env      # then put your ANTHROPIC_API_KEY in .env
npm run dev               # http://localhost:3000
npm test
```

**App**

```bash
cd mobile
npm install
echo "EXPO_PUBLIC_API_URL=http://<your-computer's-LAN-IP>:3000" > .env.local
npx expo start
```

Scan the QR code with the Expo Go app on your phone. The phone and computer must be on the same Wi-Fi network, and `localhost` won't work from the phone, so use the computer's LAN IP.

## Costs and limits

- Each new photo is one Claude API call with one image. At Claude Opus 5.5 prices ($4 / $20 per million input / output tokens) that's an estimated 3–6 cents, mostly output (thinking plus the written readings). Check real numbers in `usage` once it's running. Repeat photos cost nothing.
- Each IP address is limited to 20 readings per hour (`hourlyLimit` in `server/src/app.ts`). Behind a load balancer, set `TRUST_PROXY=1` so the limit sees real client IPs.
- If Claude's safety filters decline a photo, the request automatically falls back to another model (`fallbacks: "default"`).

## Known limitations

- **Repeat detection matches near-identical photos only.** It compares a 64-bit perceptual hash of the whole photo. Retaking the same glass from a different angle counts as a new glass. A stricter version could also compare Claude's foam descriptions against that device's recent readings.
- **Readings are kept in server memory**, so they're lost on restart and not shared between server instances. Swap `ReadingStore` (`server/src/store.ts`) for Redis or a database before deploying more than one instance.
- **No live Claude test yet.** The server tests mock Claude. The first real run with an API key is the time to tune the prompt in `server/src/oracle.ts`.
- **App store review:** Apple and Google both have rules for alcohol-related apps (age gating, no encouraging excessive drinking). The app has a legal-drinking-age check and a responsible-drinking notice, and the prompt forbids predictions that encourage drinking, driving or risky behavior. Check the current store guidelines before submitting.

## Layout

```
server/
  src/oracle.ts    Claude prompt and call, and the beer rules
  src/schema.ts    Structured-output schema for Claude's answer
  src/image.ts     Photo re-encoding and perceptual fingerprint
  src/store.ts     12-hour memory of readings, for repeat detection
  src/app.ts       HTTP API: POST /api/readings
  test/            Server tests (Claude mocked)
mobile/
  src/app/index.tsx     Age check, camera, capture
  src/app/reading.tsx   Reading for each glass
  src/lib/api.ts        Upload and device ID
```
