import React, { Component } from 'react';
import './App.css';
import champions from './champion.json'
import Header from './utility/Header';
import Modal from './utility/Modal';
import Login from './components/login/Login';

class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			roles: ["Top", "Jungle", "Mid", "Bottom", "Support"],
			randomChampions:[],
			showModal:'',
			summonerName:''
		}
		this.toggleModal = this.toggleModal.bind(this)
		this.onChange = this.onChange.bind(this);
		this.saveSummonerName = this.saveSummonerName.bind(this);
		this.logout = this.logout.bind(this);
	}

	componentDidMount(){
		let summonerName = localStorage.getItem('summonerName')
		this.setState({
			randomChampions:this.rollChampions(5),
			summonerName: summonerName !== 'undefined' ? summonerName : ''
		}) 
	}
	toggleModal(modal) {
		this.setState({
			showModal: modal
		})
	}
	onChange(e){
		this.setState({
			[e.target.name]:e.target.value
		})
	}
	saveSummonerName(e){
		e.preventDefault();
		if(/^[0-9a-z _.]+$/.test(this.state.summonerName)){
			localStorage.setItem('summonerName', this.state.summonerName);
			this.toggleModal('');
			this.setState({msg:''})
		}
		else{
			this.setState({
				msg:'Invalid summoner name'
			})
		}

	}
	logout(){
		console.log('asdsa')
		localStorage.setItem('summonerName', '')
		this.setState({
			summonerName:''
		})
	}

	render() {
		let { randomChampions, showModal, summonerName, msg } = this.state;
		let divs = randomChampions.map((champ, index) => {
			return (
				<div key={champ.name} className="champion-list-item" onClick={() => this.rerollChampion(index)}  >
					<span>{champ.name}</span>
					<img src={`${process.env.PUBLIC_URL}/champion/${champ.image}`} alt="champion"></img>
					<span>{this.state.roles[index]}</span>
				</div>
			)
		})

		return (
			<div className="App" >
				<Header title="All Random All Fill" onClick={() => !!summonerName ? this.logout() : this.toggleModal('login')} hasToken={!!summonerName}></Header>
				<div className="champion-list" >
					{divs}
				</div>
				<footer className="footer">
					You can now reroll a champion by clicking the image of the one you want to change.
				</footer>
				{
					showModal === 'login' &&
					<Modal showModal={showModal}>
						<Login onChange={this.onChange} onSubmit={this.saveSummonerName} msg={msg}></Login>
					</Modal>
				}
			</div>
		);
	}


	rollChampions() {
		let champs = []
		while(champs.length < 5){
			let element = this.rollChampion();
			
			if(!this.someChampIsSame(champs, element))
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
