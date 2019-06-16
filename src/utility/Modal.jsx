import React, { PureComponent } from 'react'

export default class Modal extends PureComponent {
    render() {
        return (
            <div className="modal" style={{ display: this.props.showModal ? '' : 'none' }} onClick={this.props.onClick}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    {this.props.children}
                </div>
            </div>
        )
    }
}
