const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';

/**
 * Fetches the latest Data Dragon version string (e.g. "14.24.1").
 */
export async function fetchLatestDDragonVersion() {
  const res = await fetch(`${DDRAGON_BASE_URL}/api/versions.json`);
  if (!res.ok) throw new Error(`Failed to fetch versions: ${res.status}`);
  const versions = await res.json();
  if (!Array.isArray(versions) || !versions[0]) {
    throw new Error('Unexpected versions response');
  }
  return versions[0];
}

/**
 * Fetches champion index JSON for a version/locale and normalizes it to an array.
 */
export async function fetchChampionList({ version, locale = 'en_US' }) {
  const res = await fetch(
    `${DDRAGON_BASE_URL}/cdn/${version}/data/${locale}/champion.json`
  );
  if (!res.ok) throw new Error(`Failed to fetch champions: ${res.status}`);
  const payload = await res.json();
  const data = payload && payload.data ? payload.data : null;
  if (!data || typeof data !== 'object') {
    throw new Error('Unexpected champion payload');
  }

  return Object.keys(data).map((key) => {
    const champ = data[key];
    return {
      id: champ.id,
      name: champ.name,
      image: champ.image && champ.image.full ? champ.image.full : '',
    };
  });
}

export function getChampionImageBaseUrl(version) {
  return `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/`;
}

/**
 * Tall loading-screen art (308x560), suited for card layouts.
 * Unversioned CDN path, so it works with any champion id.
 */
export function getChampionLoadingImageUrl(championId) {
  return `${DDRAGON_BASE_URL}/cdn/img/champion/loading/${championId}_0.jpg`;
}

