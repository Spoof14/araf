import React, { PureComponent } from 'react'
import './Login.css'

export default class Login extends PureComponent {
    render() {
        let { onChange, onSubmit, summonerName, msg } = this.props
        return (
            <form className="login-container" onSubmit={onSubmit}>
                <div className="login-input">
                    <label>
                        Summoner name:
                        <input
                            required
                            pattern="^[0-9a-z _.]+$"
                            type="text"
                            name="summonerName"
                            onChange={onChange}
                            value={summonerName || ''}
                        ></input>
                    </label>
                </div>
                {
                    msg
                    &&
                    <span style={{color:'red'}}>{msg}</span>
                }
                <input type="submit" value="Save"></input>
            </form>
        )
    }
}
