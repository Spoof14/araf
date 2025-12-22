import React, { PureComponent } from 'react'

export default class Header extends PureComponent {
    render() {
        let { hasToken, title, onSummonerClick, onRerollAll, onShare, summonerName, championSource } = this.props;
        return (
            <header className="header">
                <h1>
                    <a href="/">
                        {title}
                    </a>

                </h1>
                <div className="navigation-header">
                    <div className="header-left">
                        <span className="header-meta">
                            {championSource === 'ddragon' ? 'Latest champions' : 'Offline champions'}
                            {summonerName ? ` • ${summonerName}` : ''}
                        </span>
                    </div>
                    <div className="header-actions">
                        <button className="button" type="button" onClick={onRerollAll}>Reroll all</button>
                        <button className="button" type="button" onClick={onShare}>Share</button>
                        <button className="button" type="button" onClick={onSummonerClick}>{hasToken ? 'Remove summoner' : 'Choose summoner'}</button>
                    </div>
                </div>
            </header>

        )
    }
}
