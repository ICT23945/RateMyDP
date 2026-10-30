# Rate My DP

Rate My DP uses Gemini 3.8 Flash to critique portrait photography. The Gemini API key stays on the server and is never sent to the browser.

## Run locally

1. Install Node.js 20.6 or newer.
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to your Gemini API key.
3. Run `npm start`, then open `http://127.0.0.1:3000`.

The app sends selected JPEG, PNG, or WebP images (up to 8 MB) to the server for analysis. Gemini requests set `store: false`.

Do not expose this server publicly without adding authentication and rate limiting to protect your API key and quota.
