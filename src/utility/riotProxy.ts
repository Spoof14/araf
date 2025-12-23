type SummonerDto = {
  puuid: string;
};

type ChampionMasteryDto = {
  championId: number;
};

function getProxyBaseUrl(): string | undefined {
  // Vite env vars must be prefixed with VITE_
  return import.meta.env.VITE_RIOT_PROXY_URL as string | undefined;
}

async function proxyGet(path: string): Promise<any> {
  const base = getProxyBaseUrl();
  if (!base) {
    throw new Error(
      'Riot proxy not configured. Set VITE_RIOT_PROXY_URL to enable summoner pools.'
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

export async function fetchSummonerByName(opts: {
  region: string;
  name: string;
}): Promise<SummonerDto> {
  const safeName = encodeURIComponent(opts.name);
  return await proxyGet(`/summoner/by-name/${opts.region}/${safeName}`);
}

export async function fetchChampionMasteryByPuuid(opts: {
  region: string;
  puuid: string;
}): Promise<ChampionMasteryDto[]> {
  const safe = encodeURIComponent(opts.puuid);
  return await proxyGet(`/champion-mastery/by-puuid/${opts.region}/${safe}`);
}

