## Riot proxy (required for “summoner pools” on GitHub Pages)

GitHub Pages can’t call Riot’s APIs directly from the browser (CORS) and you should not ship a Riot API key in frontend code. This tiny proxy adds:

- **CORS headers** so the frontend can call it
- **`X-Riot-Token`** header server-side (your key stays secret)

### Cloudflare Worker quick start

1. Create a Worker and paste `worker.js`
2. Set a secret:

```bash
wrangler secret put RIOT_API_KEY
```

3. Deploy, then set in the frontend build:

```bash
REACT_APP_RIOT_PROXY_URL="https://<your-worker-subdomain>.workers.dev" yarn build
```

### Frontend calls

- `GET /summoner/by-name/:region/:name`
- `GET /champion-mastery/by-puuid/:region/:puuid`

