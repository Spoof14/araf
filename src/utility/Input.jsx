

import React from 'react'

export default function Input({name, label, onChange, value}) {
    return (
        <div className="login-input">
            <label>
                {label}:
                <input type="text" name={name} onChange={onChange} value={value}></input>
            </label>
        </div>
    )
}
