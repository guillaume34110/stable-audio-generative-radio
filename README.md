# Stable Audio Generative Radio

A browser-first generative radio player for Stable Audio 3 Medium models.

The page is intentionally small: import a local `.safetensors` adapter, enter an unlimited pool of user tags, and let the radio evolve its tempo, energy, texture, and next-track preparation procedurally. Each generation samples a different pseudo-random subset from that pool; the generation prompt contains no invented style tags. Playback, queueing, monitoring DSP, noise filtering, and intelligent limiting run in the browser.

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, or `/generative-radio.html` to keep the explicit radio route. The development server proxies `/api` to the On Us Local Engine at `http://127.0.0.1:17846`.

On the radio page, authorize the local engine once. The pairing token is kept in this browser so an installed model does not need to be imported again after a reload. If the browser blocks the request, click the connection action from the page and allow local-network access, then retry.

The browser client expects a local Stable Audio 3 API exposing:

- `GET /api/stable-audio/radio/sfts`
- `POST /api/stable-audio/radio/sfts`
- `POST /api/stable-audio/radio/generations`
- `GET /api/stable-audio/radio/generations/:id`
- `GET /api/stable-audio/radio/generations/:id/audio`

To use another local API origin, copy `.env.example` to `.env` and set `VITE_RADIO_API_URL`. When the local-engine pairing token exists, requests go directly to the paired loopback engine and include the token; generated audio and model files remain local.

## Scope

This repository contains only the standalone player. It does not include model weights, generated audio, credentials, or user data. Inference remains local through the On Us Local Engine API; the generated WAV is fetched into the browser for playback and is not sent to a cloud service by this client.

## Checks

```bash
npm test
npm run build
```

## Model

[Stable Audio 3 Medium on Hugging Face](https://huggingface.co/stabilityai/stable-audio-3-medium)

## License

MIT
