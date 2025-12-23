import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import championsJson from './champion.json';
import Header from './utility/Header';
import Modal from './utility/Modal';
import TeamSetup from './components/team/TeamSetup';
import {
  fetchChampionList,
  fetchLatestDDragonVersion,
  getChampionImageBaseUrl,
} from './utility/ddragon';
import type { Champion } from './utility/types';
import {
  fetchChampionMasteryByPuuid,
  fetchSummonerByName,
} from './utility/riotProxy';

type ChampionSource = 'ddragon' | 'local';
type ActiveModal = '' | 'team';

type ChampionData = {
  pool: Champion[];
  imageBaseUrl: string;
  source: ChampionSource;
};

function getLocalChampionPool(): Champion[] {
  const data: any = (championsJson as any).data;
  return Object.keys(data).map((id) => {
    const c = data[id];
    return {
      id: String(id),
      key: c && c.key != null ? String(c.key) : undefined,
      name: String(c.name),
      image: String(c.image.full),
    };
  });
}

function buildChampionByKey(pool: Champion[]): Record<string, Champion> {
  const map: Record<string, Champion> = {};
  for (const c of pool) {
    if (c.key) map[String(c.key)] = c;
  }
  return map;
}

function readPlayersFromStorage(): string[] {
  try {
    const raw = localStorage.getItem('players');
    if (!raw) return ['', '', '', '', ''];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ['', '', '', '', ''];
    const normalized = parsed.slice(0, 5).map((p) => String(p ?? ''));
    while (normalized.length < 5) normalized.push('');
    return normalized;
  } catch {
    return ['', '', '', '', ''];
  }
}

function readRollIdsFromUrl(): string[] {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('p');
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function validateRollIds(pool: Champion[], rollIds: string[]): string[] | null {
  if (pool.length === 0) return null;
  if (rollIds.length !== 5) return null;
  const unique = new Set(rollIds);
  if (unique.size !== 5) return null;
  const byId = new Set(pool.map((c) => c.id));
  for (const id of rollIds) if (!byId.has(id)) return null;
  return rollIds;
}

function syncUrlWithRollIds(rollIds: string[]) {
  try {
    if (rollIds.length !== 5) return;
    const params = new URLSearchParams(window.location.search);
    params.set('p', rollIds.join(','));
    const newUrl = `${window.location.pathname}?${params.toString()}${
      window.location.hash || ''
    }`;
    window.history.replaceState({}, '', newUrl);
  } catch {
    // ignore
  }
}

function rollChampionFromPool(pool: Champion[]): Champion | null {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const c = pool[idx];
  return c ? { ...c } : null;
}

function someChampIsSame(array: Champion[], newChamp: Champion | null): boolean {
  if (!newChamp) return false;
  return array.some((c) => c.id === newChamp.id);
}

function rollChampions(count: number, pool: Champion[]): Champion[] {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const target = count > 0 ? count : 5;
  const champs: Champion[] = [];
  let guard = 0;
  while (champs.length < target && guard < 5000) {
    const c = rollChampionFromPool(pool);
    if (c && !someChampIsSame(champs, c)) champs.push(c);
    guard++;
  }
  return champs;
}

export default function App() {
  const didInit = useRef(false);

  const roles = useMemo(
    () => ['Top', 'Jungle', 'Mid', 'Bottom', 'Support'],
    []
  );

  const [championData, setChampionData] = useState<ChampionData>({
    pool: [],
    imageBaseUrl: `${import.meta.env.BASE_URL}champion/`,
    source: 'local',
  });

  const [activeModal, setActiveModal] = useState<ActiveModal>('');
  const [lockedSlots, setLockedSlots] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [toast, setToast] = useState<string>('');

  const [players, setPlayers] = useState<string[]>(readPlayersFromStorage());
  const [region, setRegion] = useState<string>(
    localStorage.getItem('region') || 'na1'
  );
  const [usePlayerPools, setUsePlayerPools] = useState<boolean>(
    localStorage.getItem('usePlayerPools') === 'true'
  );
  const [playerPools, setPlayerPools] = useState<Array<Champion[] | null>>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const [poolsLoading, setPoolsLoading] = useState<boolean>(false);
  const [poolsError, setPoolsError] = useState<string>('');

  // In-app source of truth for the roll. URL mirrors this.
  const [rollIds, setRollIds] = useState<string[]>(readRollIdsFromUrl());

  const championById = useMemo(() => {
    const map = new Map<string, Champion>();
    championData.pool.forEach((c) => map.set(c.id, c));
    return map;
  }, [championData.pool]);

  const championByKey = useMemo(
    () => buildChampionByKey(championData.pool),
    [championData.pool]
  );

  const rolledChampions = useMemo(() => {
    return rollIds
      .map((id) => championById.get(id))
      .filter(Boolean) as Champion[];
  }, [championById, rollIds]);

  const teamLabel = useMemo(() => {
    const filled = players.filter((p) => p.trim()).length;
    return filled ? `Players ${filled}/5` : '';
  }, [players]);

  const getPoolForIndex = useCallback(
    (index: number): Champion[] => {
      if (usePlayerPools) {
        const name = (players[index] || '').trim();
        const pool = playerPools[index];
        if (name && Array.isArray(pool) && pool.length > 0) return pool;
      }
      return championData.pool;
    },
    [championData.pool, playerPools, players, usePlayerPools]
  );

  const loadPlayerPools = useCallback(
    async (playersArg: string[], regionArg: string) => {
      setPoolsLoading(true);
      setPoolsError('');
      try {
        const pools: Array<Champion[] | null> = [null, null, null, null, null];
        const tasks = playersArg
          .map((name, index) => ({ name: name.trim(), index }))
          .filter((x) => x.name.length > 0);

        const results = await Promise.all(
          tasks.map(async ({ name, index }) => {
            const summoner = await fetchSummonerByName({
              region: regionArg,
              name,
            });
            if (!summoner?.puuid) throw new Error(`Could not resolve ${name}`);
            const mastery = await fetchChampionMasteryByPuuid({
              region: regionArg,
              puuid: summoner.puuid,
            });
            const list = Array.isArray(mastery) ? mastery : [];

            const champs: Champion[] = [];
            const seen = new Set<string>();
            for (const m of list) {
              const id =
                m && (m as any).championId != null
                  ? String((m as any).championId)
                  : null;
              if (!id) continue;
              const c = championByKey[id];
              if (c && !seen.has(c.id)) {
                seen.add(c.id);
                champs.push(c);
              }
            }
            return { index, champs };
          })
        );

        const emptySlots: number[] = [];
        results.forEach(({ index, champs }) => {
          pools[index] = champs;
          if (champs.length === 0) emptySlots.push(index);
        });
        setPlayerPools(pools);
        if (emptySlots.length > 0) {
          setPoolsError(
            `No champions found for player slot(s): ${emptySlots
              .map((i) => i + 1)
              .join(', ')}`
          );
        }
      } catch (e) {
        setPlayerPools([null, null, null, null, null]);
        setPoolsError(e instanceof Error ? e.message : 'Failed to load pools.');
      } finally {
        setPoolsLoading(false);
      }
    },
    [championByKey]
  );

  // Initial boot: load champions, then normalize roll, then optionally load pools.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    let mounted = true;
    (async () => {
      let data: ChampionData;
      try {
        const version = await fetchLatestDDragonVersion();
        const pool = await fetchChampionList({ version, locale: 'en_US' });
        data = {
          pool,
          imageBaseUrl: getChampionImageBaseUrl(version),
          source: 'ddragon',
        };
      } catch {
        data = {
          pool: getLocalChampionPool(),
          imageBaseUrl: `${import.meta.env.BASE_URL}champion/`,
          source: 'local',
        };
      }
      if (!mounted) return;
      setChampionData(data);

      const fromUrl = readRollIdsFromUrl();
      const validated = validateRollIds(data.pool, fromUrl);
      const nextRoll = validated ?? rollChampions(5, data.pool).map((c) => c.id);
      setRollIds(nextRoll);
      syncUrlWithRollIds(nextRoll);

      const savedPlayers = readPlayersFromStorage();
      const savedRegion = localStorage.getItem('region') || 'na1';
      const savedUsePools = localStorage.getItem('usePlayerPools') === 'true';
      setPlayers(savedPlayers);
      setRegion(savedRegion);
      setUsePlayerPools(savedUsePools);

      if (savedUsePools && savedPlayers.some((p) => p.trim())) {
        await loadPlayerPools(savedPlayers, savedRegion);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadPlayerPools]);

  // Keep URL in sync with roll
  useEffect(() => {
    const valid = validateRollIds(championData.pool, rollIds);
    if (!valid) return;
    syncUrlWithRollIds(valid);
  }, [championData.pool, rollIds]);

  // ESC closes modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal) setActiveModal('');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal]);

  const toggleLock = useCallback((index: number) => {
    setLockedSlots((prev) => {
      const next = prev.slice();
      next[index] = !next[index];
      return next;
    });
  }, []);

  const rerollChampion = useCallback(
    (index: number) => {
      if (lockedSlots[index]) return;
      if (championData.pool.length === 0) return;
      if (rolledChampions.length !== 5) return;

      const pool = getPoolForIndex(index);
      const curr = rolledChampions[index];
      let candidate: Champion | null = curr ?? null;
      let attempts = 0;
      while (
        attempts < 500 &&
        ((candidate && curr && candidate.id === curr.id) ||
          someChampIsSame(rolledChampions, candidate))
      ) {
        candidate = rollChampionFromPool(pool);
        attempts++;
      }
      if (!candidate) return;

      const next = rollIds.slice();
      next[index] = candidate.id;
      setRollIds(next);
    },
    [championData.pool.length, getPoolForIndex, lockedSlots, rollIds, rolledChampions]
  );

  const rerollAll = useCallback(() => {
    if (championData.pool.length === 0) return;
    if (rolledChampions.length !== 5) return;

    const next = rolledChampions.slice();
    const used = new Set<string>();

    for (let i = 0; i < 5; i++) {
      if (lockedSlots[i] && next[i]) used.add(next[i].id);
    }

    let uniquenessFailed = false;
    for (let i = 0; i < 5; i++) {
      if (lockedSlots[i]) continue;
      const pool = getPoolForIndex(i);
      let candidate: Champion | null = null;
      let attempts = 0;
      while (attempts < 500) {
        const c = rollChampionFromPool(pool);
        if (c && !used.has(c.id)) {
          candidate = c;
          break;
        }
        attempts++;
      }
      if (!candidate) {
        const fallback = rollChampionFromPool(pool);
        if (fallback) {
          candidate = fallback;
          uniquenessFailed = true;
        }
      }
      if (candidate) {
        next[i] = candidate;
        used.add(candidate.id);
      }
    }

    setRollIds(next.map((c) => c.id));
    if (uniquenessFailed) {
      setToast('Note: could not keep all champs unique with current pools.');
      window.setTimeout(() => setToast(''), 2500);
    }
  }, [championData.pool.length, getPoolForIndex, lockedSlots, rolledChampions]);

  const shareRoll = useCallback(async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setToast('Link copied!');
        window.setTimeout(() => setToast(''), 1500);
      } else {
        setToast('Copy not supported in this browser.');
        window.setTimeout(() => setToast(''), 2000);
      }
    } catch {
      setToast('Could not copy link.');
      window.setTimeout(() => setToast(''), 2000);
    }
  }, []);

  const onPlayerChange = useCallback((index: number, value: string) => {
    setPlayers((prev) => {
      const next = prev.slice();
      next[index] = value;
      return next;
    });
  }, []);

  const saveTeam = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = players.map((p) => p.trim());
      const any = trimmed.some(Boolean);
      if (!any) {
        setPoolsError('Please enter at least one summoner name.');
        return;
      }

      localStorage.setItem('players', JSON.stringify(trimmed));
      localStorage.setItem('region', region);
      localStorage.setItem('usePlayerPools', String(usePlayerPools));

      if (usePlayerPools) {
        await loadPlayerPools(trimmed, region);
      } else {
        setPlayerPools([null, null, null, null, null]);
      }

      setActiveModal('');
    },
    [loadPlayerPools, players, region, usePlayerPools]
  );

  const championCards = rolledChampions.map((champ, index) => {
    const imgSrc = `${championData.imageBaseUrl}${champ.image}`;
    return (
      <div
        key={champ.id || champ.name}
        className={`champion-list-item ${lockedSlots[index] ? 'locked' : ''}`}
        onClick={() => rerollChampion(index)}
      >
        <div className="champion-title">{champ.name}</div>
        <div className="champion-image">
          <img src={imgSrc} alt={champ.name} />
        </div>
        <div className="champion-role">{roles[index]}</div>
        <button
          className="slot-button"
          onClick={(ev) => {
            ev.stopPropagation();
            toggleLock(index);
          }}
          type="button"
        >
          {lockedSlots[index] ? 'Unlock' : 'Lock'}
        </button>
      </div>
    );
  });

  return (
    <div className="App">
      <Header
        title="All Random All Fill"
        championSource={championData.source}
        teamLabel={teamLabel}
        poolsEnabled={usePlayerPools}
        onTeamClick={() => setActiveModal('team')}
        onRerollAll={rerollAll}
        onShare={shareRoll}
      />

      <main className="main">
        <div className="champion-list">{championCards}</div>
      </main>

      <footer className="footer">
        <div className="footer-row">
          <span>Click a slot to reroll it (unless locked).</span>
          <span className="source-pill">
            Source:{' '}
            {championData.source === 'ddragon'
              ? 'Latest (Data Dragon)'
              : 'Bundled (offline)'}
          </span>
        </div>
        {!!toast && <div className="toast">{toast}</div>}
      </footer>

      <Modal open={activeModal === 'team'} onClose={() => setActiveModal('')}>
        <TeamSetup
          players={players}
          region={region}
          onPlayerChange={onPlayerChange}
          onRegionChange={(r) => setRegion(r)}
          onSave={saveTeam}
          loading={poolsLoading}
          error={poolsError}
          usingPools={usePlayerPools}
          onTogglePools={(checked) => setUsePlayerPools(checked)}
        />
      </Modal>
    </div>
  );
}

