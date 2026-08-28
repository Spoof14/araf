import React, { Component } from 'react';
import './App.css';
import champions from './champion.json'
import Header from './utility/Header';
import Modal from './utility/Modal';
import Login from './components/login/Login';
import {
	fetchLatestDDragonVersion,
	fetchChampionList,
	getChampionImageBaseUrl,
	getChampionLoadingImageUrl
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
			summonerName: summonerName && summonerName !== 'undefined' ? summonerName : ''
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
				randomChampions: initialRoll
			},
			() => this.syncUrlWithRoll()
		);
	}

	componentWillUnmount(){
		window.removeEventListener('keydown', this.onKeyDown);
		if(this.toastTimer) window.clearTimeout(this.toastTimer);
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
		localStorage.removeItem('summonerName')
		this.setState({
			summonerName:''
		})
	}

	render() {
		let { randomChampions, showModal, summonerName, msg, championImageBaseUrl, lockedSlots, championSource, toast } = this.state;
		// Loading-screen art lives on the Data Dragon CDN, so only use it when
		// the champion list itself came from there (i.e. the network is up).
		const hasArt = championSource === 'ddragon';
		let divs = randomChampions.map((champ, index) => {
			const role = this.state.roles[index];
			const locked = lockedSlots[index];
			const iconUrl = `${championImageBaseUrl}${champ.image}`;
			return (
				<div
					key={champ.id || champ.name}
					className={`champion-list-item ${hasArt ? 'has-art' : ''} ${locked ? 'locked' : ''}`}
					onClick={() => this.rerollChampion(index)}
					onKeyDown={(e) => {
						if(e.key === 'Enter' || e.key === ' '){
							e.preventDefault();
							this.rerollChampion(index);
						}
					}}
					role="button"
					tabIndex={0}
					aria-label={`Reroll ${role} champion (currently ${champ.name})`}
				>
					{hasArt ? (
						<picture className="champion-image">
							<img src={getChampionLoadingImageUrl(champ.id)} alt={champ.name} />
						</picture>
					) : (
						<img
							className="champion-image"
							src={iconUrl}
							alt={champ.name}
							width="120"
							height="120"
						/>
					)}
					<div className="champion-info">
						<span className="champion-name">{champ.name}</span>
						<span className="champion-role">{role}</span>
					</div>
					<button
						className="slot-button"
						onClick={(e) => { e.stopPropagation(); this.toggleLock(index); }}
						type="button"
						aria-pressed={locked}
						aria-label={`${locked ? 'Unlock' : 'Lock'} ${role} champion`}
					>
						{locked ? 'Unlock' : 'Lock'}
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
				<div className="champion-list" >
					{divs}
				</div>
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

		let champs = []
		while(champs.length < 5){
			let element = this.rollChampion(pool);

			if(!this.someChampIsSame(champs, element))
				champs.push(element)
		}
		return champs
	}

	rollChampion(poolOverride){
		const pool = poolOverride ? poolOverride : this.state.championPool;
		var random = Math.floor(Math.random() * pool.length);
		var element = pool[random];
		return {id: element.id, name: element.name, image: element.image}
	}

	someChampIsSame(array, newChamp){
		return array.some(champ => champ.id === newChamp.id)
	}
	
	rerollChampion(index){
		if(this.state.lockedSlots[index]) return;

		const randomChampions = this.state.randomChampions.slice();
		const currChamp = randomChampions[index];
		let newChamp = currChamp;

		while((newChamp && currChamp && newChamp.id === currChamp.id) || this.someChampIsSame(randomChampions, newChamp)){
			newChamp = this.rollChampion()
		}
		randomChampions[index] = newChamp
		this.setState({ randomChampions }, () => this.syncUrlWithRoll());

	}

	rerollAll(){
		const { randomChampions, lockedSlots } = this.state;
		if(!Array.isArray(randomChampions) || randomChampions.length !== 5) return;

		const next = randomChampions.slice();
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
			}
		}

		this.setState({ randomChampions: next }, () => this.syncUrlWithRoll());
	}

	toggleLock(index){
		const lockedSlots = this.state.lockedSlots.slice();
		lockedSlots[index] = !lockedSlots[index];
		this.setState({ lockedSlots });
	}

	showToast(message){
		if(this.toastTimer) window.clearTimeout(this.toastTimer);
		this.setState({ toast: message });
		this.toastTimer = window.setTimeout(() => this.setState({ toast: '' }), 2500);
	}

	copyToClipboardFallback(text){
		try{
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(textarea);
			return ok;
		}catch(_e){
			return false;
		}
	}

	async shareRoll(){
		const url = window.location.href;
		let copied = false;

		if(navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
			try{
				await navigator.clipboard.writeText(url);
				copied = true;
			}catch(_e){
				// Permission denied or unavailable; try the legacy fallback below.
			}
		}
		if(!copied){
			copied = this.copyToClipboardFallback(url);
		}

		this.showToast(copied ? 'Link copied!' : 'Could not copy link.');
	}
}

export default App;
