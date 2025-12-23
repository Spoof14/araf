import React, { PureComponent } from 'react'

export default class Header extends PureComponent {
    render() {
        let { title, onRerollAll, onShare, championSource, onTeamClick, teamLabel, poolsEnabled } = this.props;
        return (
            <header className="header">
                <h1>
                    <a href={`${process.env.PUBLIC_URL || ''}/`}>
                        {title}
                    </a>

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
                        <button className="button" type="button" onClick={onRerollAll}>Reroll all</button>
                        <button className="button" type="button" onClick={onShare}>Share</button>
                        <button className="button" type="button" onClick={onTeamClick}>Team</button>
                    </div>
                </div>
            </header>

        )
    }
}
