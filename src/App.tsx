import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
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

type AppState = {
  activeModal: ActiveModal;
  lockedSlots: boolean[];
  toast: string;

  players: string[];
  region: string;
  usePlayerPools: boolean;
  playerPools: Array<Champion[] | null>;
  poolsLoading: boolean;
  poolsError: string;

  rollIds: string[];
};

type Action =
  | { type: 'openModal'; modal: ActiveModal }
  | { type: 'closeModal' }
  | { type: 'toggleLock'; index: number }
  | { type: 'setToast'; toast: string }
  | { type: 'setPlayers'; players: string[] }
  | { type: 'setRegion'; region: string }
  | { type: 'setUsePlayerPools'; use: boolean }
  | { type: 'poolsLoading' }
  | { type: 'poolsError'; error: string }
  | { type: 'setPlayerPools'; pools: Array<Champion[] | null> }
  | { type: 'setRollIds'; rollIds: string[] };

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
  try {
    if (pool.length === 0) return null;
    const byId = new Map(pool.map((c) => [c.id, c]));
    if (rollIds.length !== 5) return null;
    const unique = new Set(rollIds);
    if (unique.size !== 5) return null;
    for (const id of rollIds) {
      if (!byId.get(id)) return null;
    }
    return rollIds;
  } catch {
    return null;
  }
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

  const [championData, setChampionData] = useState<ChampionData>({
    pool: [],
    imageBaseUrl: `${import.meta.env.BASE_URL}champion/`,
    source: 'local',
  });

  const initialState: AppState = useMemo(() => {
    const savedPlayers = readPlayersFromStorage();
    const savedRegion = localStorage.getItem('region') || 'na1';
    const savedUsePools = localStorage.getItem('usePlayerPools') === 'true';
    return {
      activeModal: '',
      lockedSlots: [false, false, false, false, false],
      toast: '',
      players: savedPlayers,
      region: savedRegion,
      usePlayerPools: savedUsePools,
      playerPools: [null, null, null, null, null],
      poolsLoading: false,
      poolsError: '',
      rollIds: readRollIdsFromUrl(),
    };
  }, []);

  const [state, dispatch] = useReducer(
    (s: AppState, a: Action): AppState => {
      switch (a.type) {
        case 'openModal':
          return { ...s, activeModal: a.modal };
        case 'closeModal':
          return { ...s, activeModal: '' };
        case 'toggleLock': {
          const lockedSlots = s.lockedSlots.slice();
          lockedSlots[a.index] = !lockedSlots[a.index];
          return { ...s, lockedSlots };
        }
        case 'setToast':
          return { ...s, toast: a.toast };
        case 'setPlayers':
          return { ...s, players: a.players };
        case 'setRegion':
          return { ...s, region: a.region };
        case 'setUsePlayerPools':
          return { ...s, usePlayerPools: a.use };
        case 'poolsLoading':
          return { ...s, poolsLoading: true, poolsError: '' };
        case 'poolsError':
          return { ...s, poolsLoading: false, poolsError: a.error };
        case 'setPlayerPools':
          return { ...s, poolsLoading: false, poolsError: '', playerPools: a.pools };
        case 'setRollIds':
          return { ...s, rollIds: a.rollIds };
        default:
          return s;
      }
    },
    initialState
  );

  const championByKey = useMemo(
    () => buildChampionByKey(championData.pool),
    [championData.pool]
  );

  const championById = useMemo(() => {
    const map = new Map<string, Champion>();
    championData.pool.forEach((c) => map.set(c.id, c));
    return map;
  }, [championData.pool]);

  const teamLabel = useMemo(() => {
    const filled = state.players.filter((p) => p.trim()).length;
    return filled ? `Players ${filled}/5` : '';
  }, [state.players]);

  const getPoolForIndex = useCallback(
    (index: number): Champion[] => {
      if (state.usePlayerPools) {
        const p = state.playerPools[index];
        if (Array.isArray(p) && p.length > 0) return p;
      }
      return championData.pool;
    },
    [championData.pool, state.playerPools, state.usePlayerPools]
  );

  const loadPlayerPools = useCallback(
    async (
      playersArg: string[],
      regionArg: string,
      byKey: Record<string, Champion>
    ) => {
      dispatch({ type: 'poolsLoading' });
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
              const c = byKey[id];
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

        dispatch({ type: 'setPlayerPools', pools });
      } catch (e) {
        dispatch({
          type: 'poolsError',
          error: e instanceof Error ? e.message : 'Failed to load pools.',
        });
      }
    },
    []
  );

  // initial boot
  useEffect(() => {
    let mounted = true;
    (async () => {
      let data: ChampionData;
      try {
        const version = await fetchLatestDDragonVersion();
        const pool = await fetchChampionList({ version, locale: 'en_US' });
        data = { pool, imageBaseUrl: getChampionImageBaseUrl(version), source: 'ddragon' };
      } catch {
        data = {
          pool: getLocalChampionPool(),
          imageBaseUrl: `${import.meta.env.BASE_URL}champion/`,
          source: 'local',
        };
      }
      if (!mounted) return;
      setChampionData(data);

      // Ensure we have a valid roll for the loaded pool.
      const validated = validateRollIds(data.pool, readRollIdsFromUrl());
      const rollIds = validated ?? rollChampions(5, data.pool).map((c) => c.id);
      dispatch({ type: 'setRollIds', rollIds });
      syncUrlWithRollIds(rollIds);

      if (state.usePlayerPools && allPlayersFilled(state.players)) {
        await loadPlayerPools(
          state.players.map((p) => p.trim()),
          state.region,
          buildChampionByKey(data.pool)
        );
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.activeModal) dispatch({ type: 'closeModal' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.activeModal]);

  // Mirror roll -> URL (so rerolls update the link)
  useEffect(() => {
    const valid = validateRollIds(championData.pool, state.rollIds);
    if (!valid) return;
    syncUrlWithRollIds(valid);
  }, [championData.pool, state.rollIds]);

  const rerollChampion = useCallback(
    (index: number) => {
      if (state.lockedSlots[index]) return;
      const pool = getPoolForIndex(index);
      const current = state.rollIds
        .map((id) => championById.get(id))
        .filter(Boolean) as Champion[];
      if (current.length !== 5) return;
      const curr = current[index];
      let candidate: Champion | null = curr ?? null;
      let attempts = 0;
      while (
        attempts < 500 &&
        ((candidate && curr && candidate.id === curr.id) ||
          someChampIsSame(current, candidate))
      ) {
        candidate = rollChampionFromPool(pool);
        attempts++;
      }
      if (!candidate) return;
      const nextIds = state.rollIds.slice();
      nextIds[index] = candidate.id;
      dispatch({ type: 'setRollIds', rollIds: nextIds });
    },
    [championById, getPoolForIndex, state.lockedSlots, state.rollIds]
  );

  const rerollAll = useCallback(() => {
    const current = state.rollIds
      .map((id) => championById.get(id))
      .filter(Boolean) as Champion[];
    if (current.length !== 5) return;

    const next = current.slice();
    const used = new Set<string>();

    for (let i = 0; i < 5; i++) {
      if (state.lockedSlots[i] && next[i]) used.add(next[i].id);
    }

    let uniquenessFailed = false;
    for (let i = 0; i < 5; i++) {
      if (state.lockedSlots[i]) continue;
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

    dispatch({ type: 'setRollIds', rollIds: next.map((c) => c.id) });
    if (uniquenessFailed) {
      dispatch({
        type: 'setToast',
        toast: 'Note: could not keep all champs unique with current pools.',
      });
      window.setTimeout(() => dispatch({ type: 'setToast', toast: '' }), 2500);
    }
  }, [championById, getPoolForIndex, state.lockedSlots, state.rollIds]);

  const shareRoll = useCallback(async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        dispatch({ type: 'setToast', toast: 'Link copied!' });
        window.setTimeout(() => dispatch({ type: 'setToast', toast: '' }), 1500);
      } else {
        dispatch({ type: 'setToast', toast: 'Copy not supported in this browser.' });
        window.setTimeout(() => dispatch({ type: 'setToast', toast: '' }), 2000);
      }
    } catch {
      dispatch({ type: 'setToast', toast: 'Could not copy link.' });
      window.setTimeout(() => dispatch({ type: 'setToast', toast: '' }), 2000);
    }
  }, []);

  const onPlayerChange = useCallback((index: number, value: string) => {
    const next = state.players.slice();
    next[index] = value;
    dispatch({ type: 'setPlayers', players: next });
  }, [state.players]);

  const saveTeam = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = state.players.map((p) => p.trim());
      if (!allPlayersFilled(trimmed)) {
        dispatch({ type: 'poolsError', error: 'Please enter 5 summoner names.' });
        return;
      }

      localStorage.setItem('players', JSON.stringify(trimmed));
      localStorage.setItem('region', state.region);
      localStorage.setItem('usePlayerPools', String(state.usePlayerPools));

      if (state.usePlayerPools) {
        await loadPlayerPools(trimmed, state.region, championByKey);
      } else {
        dispatch({ type: 'setPlayerPools', pools: [null, null, null, null, null] });
      }

      dispatch({ type: 'closeModal' });
    },
    [championByKey, loadPlayerPools, state.players, state.region, state.usePlayerPools]
  );

  const rolledChampions = useMemo(() => {
    const champs = state.rollIds
      .map((id) => championById.get(id))
      .filter(Boolean) as Champion[];
    return champs;
  }, [championById, state.rollIds]);

  const championCards = rolledChampions.map((champ, index) => {
    const imgSrc = `${championData.imageBaseUrl}${champ.image}`;
    return (
      <div
        key={champ.id || champ.name}
        className={`champion-list-item ${state.lockedSlots[index] ? 'locked' : ''}`}
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
            dispatch({ type: 'toggleLock', index });
          }}
          type="button"
        >
          {state.lockedSlots[index] ? 'Unlock' : 'Lock'}
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
        poolsEnabled={state.usePlayerPools}
        onTeamClick={() => dispatch({ type: 'openModal', modal: 'team' })}
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
            Source: {championData.source === 'ddragon' ? 'Latest (Data Dragon)' : 'Bundled (offline)'}
          </span>
        </div>
        {!!state.toast && <div className="toast">{state.toast}</div>}
      </footer>

      <Modal open={state.activeModal === 'team'} onClose={() => dispatch({ type: 'closeModal' })}>
        <TeamSetup
          players={state.players}
          region={state.region}
          onPlayerChange={onPlayerChange}
          onRegionChange={(r) => {
            dispatch({ type: 'setRegion', region: r });
            localStorage.setItem('region', r);
          }}
          onSave={saveTeam}
          loading={state.poolsLoading}
          error={state.poolsError}
          usingPools={state.usePlayerPools}
          onTogglePools={(checked) => {
            dispatch({ type: 'setUsePlayerPools', use: checked });
            localStorage.setItem('usePlayerPools', String(checked));
          }}
        />
      </Modal>
    </div>
  );
}

