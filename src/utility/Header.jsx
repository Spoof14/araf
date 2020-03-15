import React, { PureComponent } from 'react'

export default class Header extends PureComponent {
    render() {
        let { hasToken, title, onClick } = this.props;
        return (
            <div>
                <h1>
                    <a href="/">
                        {title}
                    </a>

                </h1>
                {/* <div className="navigation-header">
                    <div className="button" onClick={onClick}>{hasToken ?'Remove summoner' : 'Choose summoner'}</div>
                </div> */}
            </div>

        )
    }
}
