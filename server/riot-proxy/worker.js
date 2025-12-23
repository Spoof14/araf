/**
 * Cloudflare Worker Riot proxy (CORS-enabled)
 *
 * Set secret env var: RIOT_API_KEY
 *
 * Routes:
 * - /summoner/by-name/:region/:name
 * - /champion-mastery/by-puuid/:region/:puuid
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      const riotKey = env.RIOT_API_KEY;
      if (!riotKey) {
        return new Response('Missing RIOT_API_KEY', {
          status: 500,
          headers: corsHeaders,
        });
      }

      let riotPath = null;
      let region = null;

      if (parts[0] === 'summoner' && parts[1] === 'by-name') {
        region = parts[2];
        const name = decodeURIComponent(parts.slice(3).join('/'));
        riotPath = `/lol/summoner/v4/summoners/by-name/${encodeURIComponent(
          name
        )}`;
      } else if (parts[0] === 'champion-mastery' && parts[1] === 'by-puuid') {
        region = parts[2];
        const puuid = decodeURIComponent(parts.slice(3).join('/'));
        riotPath = `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(
          puuid
        )}`;
      }

      if (!riotPath || !region) {
        return new Response('Not found', { status: 404, headers: corsHeaders });
      }

      const riotUrl = `https://${region}.api.riotgames.com${riotPath}`;
      const res = await fetch(riotUrl, {
        method: 'GET',
        headers: {
          'X-Riot-Token': riotKey,
        },
      });

      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'content-type': res.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store',
        },
      });
    } catch (e) {
      return new Response(`Proxy error: ${e && e.message ? e.message : e}`, {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};

