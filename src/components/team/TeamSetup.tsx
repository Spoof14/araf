import './TeamSetup.css';
import type { FormEvent } from 'react';

type Props = {
  players: string[];
  region: string;
  onPlayerChange: (index: number, value: string) => void;
  onRegionChange: (region: string) => void;
  onSave: (e: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string;
  usingPools: boolean;
  onTogglePools: (checked: boolean) => void;
};

export default function TeamSetup({
  players,
  region,
  onPlayerChange,
  onRegionChange,
  onSave,
  loading,
  error,
  usingPools,
  onTogglePools,
}: Props) {
  const filled = Array.isArray(players)
    ? players.filter((p) => (p || '').trim().length > 0).length
    : 0;

  return (
    <form className="team-container" onSubmit={onSave}>
      <div className="team-title">Team setup</div>

      <div className="team-row">
        <label>
          Region:
          <select
            value={region}
            onChange={(e) => onRegionChange(e.target.value)}
            name="region"
          >
            <option value="na1">NA</option>
            <option value="euw1">EUW</option>
            <option value="eun1">EUNE</option>
            <option value="kr">KR</option>
            <option value="jp1">JP</option>
            <option value="br1">BR</option>
            <option value="la1">LAN</option>
            <option value="la2">LAS</option>
            <option value="oc1">OCE</option>
            <option value="tr1">TR</option>
            <option value="ru">RU</option>
            <option value="ph2">PH</option>
            <option value="sg2">SG</option>
            <option value="th2">TH</option>
            <option value="tw2">TW</option>
            <option value="vn2">VN</option>
          </select>
        </label>
      </div>

      <div className="team-grid">
        {players.map((p, idx) => (
          <div className="team-input" key={idx}>
            <label>
              Player {idx + 1}:
              <input
                type="text"
                value={p || ''}
                onChange={(e) => onPlayerChange(idx, e.target.value)}
                placeholder="Summoner name"
                required
              />
            </label>
          </div>
        ))}
      </div>

      <div className="team-controls">
        <label className="team-toggle">
          <input
            type="checkbox"
            checked={!!usingPools}
            onChange={(e) => onTogglePools(e.target.checked)}
          />
          Use summoner champion pools (requires proxy)
        </label>

        <button className="team-button" type="submit" disabled={loading}>
          {loading ? 'Loading pools…' : `Save (${filled}/5)`}
        </button>
      </div>

      {!!error && <div className="team-error">{error}</div>}
      <div className="team-help">
        Note: GitHub Pages can’t call Riot APIs directly. To enable pools, set
        <code> VITE_RIOT_PROXY_URL </code> to a small proxy that injects your
        Riot API key.
      </div>
    </form>
  );
}

