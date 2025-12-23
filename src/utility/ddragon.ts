import type { Champion } from './types';

const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';

export async function fetchLatestDDragonVersion(): Promise<string> {
  const res = await fetch(`${DDRAGON_BASE_URL}/api/versions.json`);
  if (!res.ok) throw new Error(`Failed to fetch versions: ${res.status}`);
  const versions: unknown = await res.json();
  if (!Array.isArray(versions) || typeof versions[0] !== 'string') {
    throw new Error('Unexpected versions response');
  }
  return versions[0];
}

export async function fetchChampionList({
  version,
  locale = 'en_US',
}: {
  version: string;
  locale?: string;
}): Promise<Champion[]> {
  const res = await fetch(
    `${DDRAGON_BASE_URL}/cdn/${version}/data/${locale}/champion.json`
  );
  if (!res.ok) throw new Error(`Failed to fetch champions: ${res.status}`);
  const payload: any = await res.json();
  const data = payload && payload.data ? payload.data : null;
  if (!data || typeof data !== 'object') {
    throw new Error('Unexpected champion payload');
  }

  return Object.keys(data).map((k) => {
    const champ = data[k];
    return {
      id: String(champ.id),
      key: champ.key != null ? String(champ.key) : undefined,
      name: String(champ.name),
      image: champ.image && champ.image.full ? String(champ.image.full) : '',
    };
  });
}

export function getChampionImageBaseUrl(version: string): string {
  return `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/`;
}

