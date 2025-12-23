import { useCallback, useEffect, useMemo, useState } from 'react';
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
    if (c.key) map[c.key] = c;
  }
  return map;
}

function allPlayersFilled(players: string[]): boolean {
  return players.length === 5 && players.every((p) => p.trim().length > 0);
}

function readPlayersFromStorage(): string[] {
  try {
    const raw = localStorage.getItem('players');
    if (!raw) return ['', '', '', '', ''];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 5) return ['', '', '', '', ''];
    return parsed.map((p) => String(p ?? ''));
  } catch {
    return ['', '', '', '', ''];
  }
}

function getRollFromUrl(pool: Champion[]): Champion[] | null {
  try {
    if (pool.length === 0) return null;
    const byId = new Map(pool.map((c) => [c.id, c]));
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('p');
    if (!raw) return null;
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length !== 5) return null;
    const unique = new Set(ids);
    if (unique.size !== 5) return null;
    const champs = ids.map((id) => byId.get(id)).filter(Boolean) as Champion[];
    if (champs.length !== 5) return null;
    return champs.map((c) => ({ ...c }));
  } catch {
    return null;
  }
}

function syncUrlWithRoll(champs: Champion[]) {
  try {
    if (champs.length !== 5) return;
    const ids = champs.map((c) => c.id);
    const params = new URLSearchParams(window.location.search);
    params.set('p', ids.join(','));
    const newUrl = `${window.location.pathname}?${params.toString()}${
      window.location.hash || ''
    }`;
    window.history.replaceState({}, '', newUrl);
  } catch {
    // ignore
  }
}

function rollChampionFromPool(pool: Champion[]): Champion | null {
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const c = pool[idx];
  return c ? { ...c } : null;
}

function someChampIsSame(array: Champion[], newChamp: Champion | null): boolean {
  if (!newChamp) return false;
  return array.some((c) => c.id === newChamp.id);
}

function rollChampions(count: number, pool: Champion[]): Champion[] {
  if (pool.length === 0) return [];
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
  const roles = useMemo(
    () => ['Top', 'Jungle', 'Mid', 'Bottom', 'Support'],
    []
  );

  const [activeModal, setActiveModal] = useState<ActiveModal>('');

  const [championPool, setChampionPool] = useState<Champion[]>([]);
  const [championByKey, setChampionByKey] = useState<Record<string, Champion>>(
    {}
  );
  const [championImageBaseUrl, setChampionImageBaseUrl] = useState<string>(
    `${import.meta.env.BASE_URL}champion/`
  );
  const [championSource, setChampionSource] = useState<ChampionSource>('local');

  const [randomChampions, setRandomChampions] = useState<Champion[]>([]);
  const [lockedSlots, setLockedSlots] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [toast, setToast] = useState<string>('');

  const [players, setPlayers] = useState<string[]>(['', '', '', '', '']);
  const [region, setRegion] = useState<string>('na1');
  const [usePlayerPools, setUsePlayerPools] = useState<boolean>(false);
  const [playerPools, setPlayerPools] = useState<Array<Champion[] | null>>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const [poolsLoading, setPoolsLoading] = useState<boolean>(false);
  const [poolsError, setPoolsError] = useState<string>('');

  const teamLabel = useMemo(() => {
    const filled = players.filter((p) => p.trim()).length;
    return filled ? `Players ${filled}/5` : '';
  }, [players]);

  const getPoolForIndex = useCallback(
    (index: number): Champion[] => {
      if (usePlayerPools) {
        const p = playerPools[index];
        if (Array.isArray(p) && p.length > 0) return p;
      }
      return championPool;
    },
    [championPool, playerPools, usePlayerPools]
  );

  const loadChampionPool = useCallback(async () => {
    try {
      const version = await fetchLatestDDragonVersion();
      const list = await fetchChampionList({ version, locale: 'en_US' });
      if (!list.length) throw new Error('Empty champion list');
      setChampionPool(list);
      setChampionByKey(buildChampionByKey(list));
      setChampionImageBaseUrl(getChampionImageBaseUrl(version));
      setChampionSource('ddragon');
      return list;
    } catch {
      const localPool = getLocalChampionPool();
      setChampionPool(localPool);
      setChampionByKey(buildChampionByKey(localPool));
      setChampionImageBaseUrl(`${import.meta.env.BASE_URL}champion/`);
      setChampionSource('local');
      return localPool;
    }
  }, []);

  const loadPlayerPools = useCallback(
    async (playersArg: string[], regionArg: string) => {
      setPoolsLoading(true);
      setPoolsError('');
      try {
        const pools = await Promise.all(
          playersArg.map(async (name) => {
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
              const id = m && (m as any).championId != null ? String((m as any).championId) : null;
              if (!id) continue;
              const c = championByKey[id];
              if (c && !seen.has(c.id)) {
                seen.add(c.id);
                champs.push(c);
              }
            }
            return champs;
          })
        );

        const emptyIdx = pools.findIndex((p) => !p || p.length === 0);
        if (emptyIdx !== -1) throw new Error(`No champions found for player ${emptyIdx + 1}.`);

        setPlayerPools(pools);
      } catch (e) {
        setPlayerPools([null, null, null, null, null]);
        setPoolsError(e instanceof Error ? e.message : 'Failed to load pools.');
      } finally {
        setPoolsLoading(false);
      }
    },
    [championByKey]
  );

  // initial boot
  useEffect(() => {
    let mounted = true;
    (async () => {
      const pool = await loadChampionPool();
      if (!mounted) return;

      const restored = getRollFromUrl(pool);
      const initialRoll = restored ?? rollChampions(5, pool);
      setRandomChampions(initialRoll);
      syncUrlWithRoll(initialRoll);

      const savedPlayers = readPlayersFromStorage();
      const savedRegion = localStorage.getItem('region') || 'na1';
      const savedUsePools = localStorage.getItem('usePlayerPools') === 'true';
      setPlayers(savedPlayers);
      setRegion(savedRegion);
      setUsePlayerPools(savedUsePools);

      if (savedUsePools && allPlayersFilled(savedPlayers)) {
        await loadPlayerPools(
          savedPlayers.map((p) => p.trim()),
          savedRegion
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadChampionPool, loadPlayerPools]);

  // keyboard
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
      const pool = getPoolForIndex(index);
      setRandomChampions((prev) => {
        const next = prev.slice();
        const curr = next[index];
        let candidate: Champion | null = curr ?? null;
        let attempts = 0;
        while (
          attempts < 500 &&
          ((candidate && curr && candidate.id === curr.id) ||
            someChampIsSame(next, candidate))
        ) {
          candidate = rollChampionFromPool(pool);
          attempts++;
        }
        if (!candidate) return prev;
        next[index] = candidate;
        syncUrlWithRoll(next);
        return next;
      });
    },
    [getPoolForIndex, lockedSlots]
  );

  const rerollAll = useCallback(() => {
    setRandomChampions((prev) => {
      if (prev.length !== 5) return prev;
      const next = prev.slice();
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

      syncUrlWithRoll(next);
      if (uniquenessFailed) {
        setToast('Note: could not keep all champs unique with current pools.');
        window.setTimeout(() => setToast(''), 2500);
      }
      return next;
    });
  }, [getPoolForIndex, lockedSlots]);

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
      if (!allPlayersFilled(trimmed)) {
        setPoolsError('Please enter 5 summoner names.');
        return;
      }

      localStorage.setItem('players', JSON.stringify(trimmed));
      localStorage.setItem('region', region);
      localStorage.setItem('usePlayerPools', String(usePlayerPools));
      setPoolsError('');

      if (usePlayerPools) {
        await loadPlayerPools(trimmed, region);
      } else {
        setPlayerPools([null, null, null, null, null]);
      }

      setActiveModal('');
    },
    [loadPlayerPools, players, region, usePlayerPools]
  );

  const championCards = randomChampions.map((champ, index) => {
    const imgSrc = `${championImageBaseUrl}${champ.image}`;
    return (
      <div
        key={champ.id || champ.name}
        className={`champion-list-item ${lockedSlots[index] ? 'locked' : ''}`}
        onClick={() => rerollChampion(index)}
      >
        <div className="champion-title">{champ.name}</div>
        <div className="champion-image">
          <img
            src={imgSrc}
            alt={champ.name}
          />
        </div>
        <div className="champion-role">{roles[index]}</div>
        <button
          className="slot-button"
          onClick={(e) => {
            e.stopPropagation();
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
        championSource={championSource}
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
            Source: {championSource === 'ddragon' ? 'Latest (Data Dragon)' : 'Bundled (offline)'}
          </span>
        </div>
        {!!toast && <div className="toast">{toast}</div>}
      </footer>

      <Modal open={activeModal === 'team'} onClose={() => setActiveModal('')}>
        <TeamSetup
          players={players}
          region={region}
          onPlayerChange={onPlayerChange}
          onRegionChange={setRegion}
          onSave={saveTeam}
          loading={poolsLoading}
          error={poolsError}
          usingPools={usePlayerPools}
          onTogglePools={setUsePlayerPools}
        />
      </Modal>
    </div>
  );
}

