import React, { Component } from 'react';
import './App.css';
import champions from './champion.json'

class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			roles: ["Top", "Jungle", "Mid", "Bottom", "Support"],
			randomChampions:[]
		}
	}

	componentDidMount(){
		this.setState({
			randomChampions:this.rollChampions(5)
		}) 
	}

	render() {
		let {randomChampions} = this.state;
		let divs = randomChampions.map((champ, index) => {
			return (
				<div key={champ.name} onClick={() => this.rerollChampion(index)} style={{ display: 'flex', flexDirection: 'column', margin: '1rem', cursor: 'pointer' }} >
					<span>{champ.name}</span>
					<img src={`${process.env.PUBLIC_URL}/champion/${champ.image}`} height='100px' width='100px' alt="champion"></img>
					<span>{this.state.roles[index]}</span>
				</div>
			)
		})
		
		return (
			<div className="App" style={{display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
				{divs}
			</div>
		);
	}


	rollChampions() {
		let champs = []
		while(champs.length < 5){
			let element = this.rollChampion();
			
			if(!champs.some(e => e.name === element.name))
				champs.push(element)
		}
		return champs
	}



	rollChampion(){
		var random = Math.floor(Math.random() * Object.keys(champions.data).length);
		var key = Object.keys(champions.data)[random];
		var element = champions.data[key];
		return {name: element.name, image: element.image.full}
	}

	someChampIsSame(array, newChamp){
		return array.some(champ => champ.name === newChamp.name)
	}
	
	rerollChampion(index){
		let { randomChampions } = this.state;
		let currChamp = randomChampions[index];
		let newChamp = currChamp;
		
		while(newChamp === currChamp || this.someChampIsSame(randomChampions, newChamp)){
			newChamp = this.rollChampion()
		}
		randomChampions[index] = newChamp
		this.setState({
			randomChampions
		})

	}
}

export default App;
