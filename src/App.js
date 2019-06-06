import React, { Component } from 'react';
import './App.css';
import champions from './champion.json'

class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			roles: ["Top", "Jungle", "Mid", "Bottom", "Support"]
		}
	}

	render() {
		let divs = [];
		this.rollChampions(5).forEach(champion => {
			divs.push(
				<div key={champion.element.name} style={{display:'flex', flexDirection:'column', margin:'1rem'}}>
				
					<span>{champion.element.name}</span>
					<img src={`${process.env.PUBLIC_URL}/champion/${champion.element.image.full}`} height='100px' width='100px' alt="champion"></img>
					<span>{champion.role}</span>
				</div>
			)
		})
		return (
			<div className="App" style={{display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
				{divs}
			</div>
		);
	}


	rollChampions(numberOfChampions) {
		let champs = new Map();
		while(champs.size < numberOfChampions){
			var random = Math.floor(Math.random() * Object.keys(champions.data).length + 1);
			var key = Object.keys(champions.data)[random];
			var element = champions.data[key];
			champs.set(element.name, {element: element, role: this.state.roles[champs.size]})
		}
		return champs
	}
}

export default App;
