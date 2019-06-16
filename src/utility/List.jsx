import React, { PureComponent } from 'react'

export default class List extends PureComponent {
    render() {
        let { Component, items, listName, ...rest } = this.props;

        let listItems = items.map((item, index) => <Component item={item} key={item._id ? item._id : index} {...rest}/>)
        return (
            <div className={listName}>
                {listItems}
            </div>
        )
    }
}
