function getProxyBaseUrl() {
  return process.env.REACT_APP_RIOT_PROXY_URL;
}

async function proxyGet(path) {
  const base = getProxyBaseUrl();
  if (!base) {
    throw new Error(
      'Riot proxy not configured. Set REACT_APP_RIOT_PROXY_URL to enable summoner pools.'
    );
  }
  const url = `${base.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Proxy request failed (${res.status}): ${text || url}`);
  }
  return await res.json();
}

export async function fetchSummonerByName({ region, name }) {
  const safeName = encodeURIComponent(name);
  return await proxyGet(`/summoner/by-name/${region}/${safeName}`);
}

export async function fetchChampionMasteryByPuuid({ region, puuid }) {
  const safe = encodeURIComponent(puuid);
  return await proxyGet(`/champion-mastery/by-puuid/${region}/${safe}`);
}

