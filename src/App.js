import React, { Component } from 'react';
import './App.css';
import champions from './champion.json'
import Header from './utility/Header';
import Modal from './utility/Modal';
import Login from './components/login/Login';
import {
	fetchLatestDDragonVersion,
	fetchChampionList,
	getChampionImageBaseUrl
} from './utility/ddragon';

class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			roles: ["Top", "Jungle", "Mid", "Bottom", "Support"],
			randomChampions:[],
			showModal:'',
			summonerName:'',
			msg:'',
			championPool: [],
			championImageBaseUrl: `${process.env.PUBLIC_URL}/champion/`,
			championSource: 'local', // 'ddragon' | 'local'
			lockedSlots: [false, false, false, false, false],
			imageLoaded: [false, false, false, false, false],
			toast: ''
		}
		this.toggleModal = this.toggleModal.bind(this)
		this.onChange = this.onChange.bind(this);
		this.saveSummonerName = this.saveSummonerName.bind(this);
		this.logout = this.logout.bind(this);
		this.rerollChampion = this.rerollChampion.bind(this);
		this.rerollAll = this.rerollAll.bind(this);
		this.toggleLock = this.toggleLock.bind(this);
		this.shareRoll = this.shareRoll.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
	}

	async componentDidMount(){
		let summonerName = localStorage.getItem('summonerName')
		this.setState({
			summonerName: summonerName !== 'undefined' ? summonerName : ''
		})

		window.addEventListener('keydown', this.onKeyDown);

		// Try to load latest champions from Riot Data Dragon (no API key).
		// Fall back to bundled champion.json if fetch/network isn't available.
		const { pool, imageBaseUrl, source } = await this.loadChampionPool();

		const restored = this.getRollFromUrl(pool);
		const initialRoll = restored ? restored : this.rollChampions(5, pool);

		this.setState(
			{
				championPool: pool,
				championImageBaseUrl: imageBaseUrl,
				championSource: source,
				randomChampions: initialRoll,
				imageLoaded: [false, false, false, false, false]
			},
			() => this.syncUrlWithRoll()
		);
	}

	componentWillUnmount(){
		window.removeEventListener('keydown', this.onKeyDown);
	}

	onKeyDown(e){
		if(e.key === 'Escape' && this.state.showModal){
			this.toggleModal('');
		}
	}

	async loadChampionPool() {
		try {
			if (typeof fetch !== 'function') {
				throw new Error('fetch not available');
			}

			const version = await fetchLatestDDragonVersion();
			const list = await fetchChampionList({ version, locale: 'en_US' });
			if (!Array.isArray(list) || list.length === 0) {
				throw new Error('Empty champion list');
			}

			return {
				pool: list,
				imageBaseUrl: getChampionImageBaseUrl(version),
				source: 'ddragon'
			};
		} catch (e) {
			// Local fallback (keeps app working offline and in tests).
			const localPool = Object.keys(champions.data).map((key) => {
				const c = champions.data[key];
				return { id: key, name: c.name, image: c.image.full };
			});
			return {
				pool: localPool,
				imageBaseUrl: `${process.env.PUBLIC_URL}/champion/`,
				source: 'local'
			};
		}
	}

	getRollFromUrl(pool){
		try{
			if(!pool || pool.length === 0) return null;
			const byId = new Map(pool.map((c) => [c.id, c]));
			const params = new URLSearchParams(window.location.search);
			const raw = params.get('p');
			if(!raw) return null;
			const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
			if(ids.length !== 5) return null;
			const unique = new Set(ids);
			if(unique.size !== 5) return null;
			const champs = ids.map((id) => byId.get(id)).filter(Boolean);
			if(champs.length !== 5) return null;
			return champs.map((c) => ({ id: c.id, name: c.name, image: c.image }));
		}catch(_e){
			return null;
		}
	}

	syncUrlWithRoll(){
		try{
			const champs = this.state.randomChampions;
			if(!Array.isArray(champs) || champs.length !== 5) return;
			const ids = champs.map(c => c && c.id).filter(Boolean);
			if(ids.length !== 5) return;
			const params = new URLSearchParams(window.location.search);
			params.set('p', ids.join(','));
			const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ''}`;
			window.history.replaceState({}, '', newUrl);
		}catch(_e){
			// ignore
		}
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
		localStorage.setItem('summonerName', '')
		this.setState({
			summonerName:''
		})
	}

	render() {
		let { randomChampions, showModal, summonerName, msg, championImageBaseUrl, lockedSlots, championSource, toast, imageLoaded } = this.state;
		let divs = randomChampions.map((champ, index) => {
			const loaded = !!imageLoaded[index];
			const imgSrc = `${championImageBaseUrl}${champ.image}`;
			return (
				<div key={champ.id || champ.name} className={`champion-list-item ${lockedSlots[index] ? 'locked' : ''}`} onClick={() => this.rerollChampion(index)}  >
					<div className="champion-title">{champ.name}</div>
					<div className="champion-image" aria-busy={!loaded}>
						{!loaded && <div className="image-placeholder" aria-hidden="true"></div>}
						<img
							src={imgSrc}
							alt={champ.name}
							className={loaded ? 'loaded' : 'loading'}
							onLoad={() => this.markImageLoaded(index, champ.id)}
							onError={() => this.markImageLoaded(index, champ.id)}
						/>
					</div>
					<div className="champion-role">{this.state.roles[index]}</div>
					<button
						className="slot-button"
						onClick={(e) => { e.stopPropagation(); this.toggleLock(index); }}
						type="button"
					>
						{lockedSlots[index] ? 'Unlock' : 'Lock'}
					</button>
				</div>
			)
		})

		return (
			<div className="App" >
				<Header
					title="All Random All Fill"
					hasToken={!!summonerName}
					summonerName={summonerName}
					championSource={championSource}
					onSummonerClick={() => !!summonerName ? this.logout() : this.toggleModal('login')}
					onRerollAll={this.rerollAll}
					onShare={this.shareRoll}
				/>
				<main className="main">
					<div className="champion-list" >
						{divs}
					</div>
				</main>
				<footer className="footer">
					<div className="footer-row">
						<span>Click a slot to reroll it (unless locked).</span>
						<span className="source-pill">Source: {championSource === 'ddragon' ? 'Latest (Data Dragon)' : 'Bundled (offline)'}</span>
					</div>
					{!!toast && <div className="toast">{toast}</div>}
				</footer>
				{
					showModal === 'login' &&
					<Modal showModal={showModal} onClick={() => this.toggleModal('')}>
						<Login onChange={this.onChange} onSubmit={this.saveSummonerName} msg={msg} summonerName={summonerName}></Login>
					</Modal>
				}
			</div>
		);
	}

	rollChampions(_count, poolOverride) {
		const pool = poolOverride ? poolOverride : this.state.championPool;
		if (!Array.isArray(pool) || pool.length === 0) return [];

		const count = typeof _count === 'number' && _count > 0 ? _count : 5;
		let champs = []
		while(champs.length < count){
			let element = this.rollChampionFromPool(pool);
			
			if(!this.someChampIsSame(champs, element))
				champs.push(element)
		}
		return champs
	}

	rollChampionFromPool(pool){
		if(!Array.isArray(pool) || pool.length === 0) return null;
		var random = Math.floor(Math.random() * pool.length);
		var element = pool[random];
		if(!element) return null;
		return {id: element.id, name: element.name, image: element.image}
	}

	rollChampion(poolOverride){
		const pool = poolOverride ? poolOverride : this.state.championPool;
		return this.rollChampionFromPool(pool);
	}

	someChampIsSame(array, newChamp){
		if(!newChamp) return false;
		return array.some(champ => champ && champ.id === newChamp.id)
	}
	
	rerollChampion(index){
		if(this.state.lockedSlots[index]) return;

		let { randomChampions } = this.state;
		let currChamp = randomChampions[index];
		let newChamp = currChamp;
		
		while((newChamp && currChamp && newChamp.id === currChamp.id) || this.someChampIsSame(randomChampions, newChamp)){
			newChamp = this.rollChampion()
		}
		randomChampions[index] = newChamp
		const imageLoaded = this.state.imageLoaded.slice();
		imageLoaded[index] = false;
		this.setState({ randomChampions, imageLoaded }, () => this.syncUrlWithRoll());

	}

	rerollAll(){
		const { randomChampions, lockedSlots } = this.state;
		if(!Array.isArray(randomChampions) || randomChampions.length !== 5) return;

		const next = randomChampions.slice();
		const imageLoaded = this.state.imageLoaded.slice();
		const used = new Set();

		// Keep locked champs.
		for(let i=0;i<5;i++){
			if(lockedSlots[i] && next[i] && next[i].id){
				used.add(next[i].id);
			}
		}

		// Reroll unlocked slots ensuring uniqueness.
		for(let i=0;i<5;i++){
			if(lockedSlots[i]) continue;
			let candidate = null;
			let attempts = 0;
			while(attempts < 500){
				const c = this.rollChampion();
				if(c && c.id && !used.has(c.id)){
					candidate = c;
					break;
				}
				attempts++;
			}
			if(candidate){
				next[i] = candidate;
				used.add(candidate.id);
				imageLoaded[i] = false;
			}
		}

		this.setState({ randomChampions: next, imageLoaded }, () => this.syncUrlWithRoll());
	}

	markImageLoaded(index, champId){
		try{
			const current = this.state.randomChampions[index];
			if(!current || current.id !== champId) return;
			const imageLoaded = this.state.imageLoaded.slice();
			if(imageLoaded[index]) return;
			imageLoaded[index] = true;
			this.setState({ imageLoaded });
		}catch(_e){
			// ignore
		}
	}

	toggleLock(index){
		const lockedSlots = this.state.lockedSlots.slice();
		lockedSlots[index] = !lockedSlots[index];
		this.setState({ lockedSlots });
	}

	async shareRoll(){
		try{
			const url = window.location.href;
			if(navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
				await navigator.clipboard.writeText(url);
				this.setState({ toast: 'Link copied!' });
				window.setTimeout(() => this.setState({ toast: '' }), 1500);
			}else{
				this.setState({ toast: 'Copy not supported in this browser.' });
				window.setTimeout(() => this.setState({ toast: '' }), 2000);
			}
		}catch(_e){
			this.setState({ toast: 'Could not copy link.' });
			window.setTimeout(() => this.setState({ toast: '' }), 2000);
		}
	}
}

export default App;
