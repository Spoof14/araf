type Props = {
  title: string;
  championSource: 'ddragon' | 'local';
  teamLabel?: string;
  poolsEnabled?: boolean;
  onRerollAll: () => void;
  onShare: () => void;
  onTeamClick: () => void;
};

export default function Header({
  title,
  championSource,
  teamLabel,
  poolsEnabled,
  onRerollAll,
  onShare,
  onTeamClick,
}: Props) {
  return (
    <header className="header">
      <h1>
        <a href={`${import.meta.env.BASE_URL}`}>{title}</a>
      </h1>
      <div className="navigation-header">
        <div className="header-left">
          <span className="header-meta">
            {championSource === 'ddragon' ? 'Latest champions' : 'Offline champions'}
            {teamLabel ? ` • ${teamLabel}` : ''}
            {poolsEnabled ? ' • Pools on' : ''}
          </span>
        </div>
        <div className="header-actions">
          <button className="button" type="button" onClick={onRerollAll}>
            Reroll all
          </button>
          <button className="button" type="button" onClick={onShare}>
            Share
          </button>
          <button className="button" type="button" onClick={onTeamClick}>
            Team
          </button>
        </div>
      </div>
    </header>
  );
}

