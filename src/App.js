import React, { Component } from 'react';
import './App.css';
import champions from './champion.json'
import Header from './utility/Header';
import Modal from './utility/Modal';
import TeamSetup from './components/team/TeamSetup';
import {
	fetchLatestDDragonVersion,
	fetchChampionList,
	getChampionImageBaseUrl
} from './utility/ddragon';
import { fetchSummonerByName, fetchChampionMasteryByPuuid } from './utility/riotProxy';

class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			roles: ["Top", "Jungle", "Mid", "Bottom", "Support"],
			randomChampions:[],
			showModal:'',
			championPool: [],
			championByKey: {},
			championImageBaseUrl: `${process.env.PUBLIC_URL}/champion/`,
			championSource: 'local', // 'ddragon' | 'local'
			lockedSlots: [false, false, false, false, false],
			imageLoaded: [false, false, false, false, false],
			toast: '',

			players: ['', '', '', '', ''],
			region: 'na1',
			usePlayerPools: false,
			playerPools: [null, null, null, null, null],
			poolsLoading: false,
			poolsError: ''
		}
		this.toggleModal = this.toggleModal.bind(this)
		this.saveTeam = this.saveTeam.bind(this);
		this.onPlayerChange = this.onPlayerChange.bind(this);
		this.onRegionChange = this.onRegionChange.bind(this);
		this.toggleUsePlayerPools = this.toggleUsePlayerPools.bind(this);
		this.rerollChampion = this.rerollChampion.bind(this);
		this.rerollAll = this.rerollAll.bind(this);
		this.toggleLock = this.toggleLock.bind(this);
		this.shareRoll = this.shareRoll.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
	}

	async componentDidMount(){
		window.addEventListener('keydown', this.onKeyDown);

		// Try to load latest champions from Riot Data Dragon (no API key).
		// Fall back to bundled champion.json if fetch/network isn't available.
		const { pool, imageBaseUrl, source } = await this.loadChampionPool();
		const championByKey = {};
		pool.forEach((c) => {
			if (c && c.key) championByKey[String(c.key)] = c;
		});

		const restored = this.getRollFromUrl(pool);
		const initialRoll = restored ? restored : this.rollChampions(5, pool);

		const savedPlayers = this.readPlayersFromStorage();
		const savedRegion = localStorage.getItem('region') || 'na1';
		const savedUsePools = localStorage.getItem('usePlayerPools') === 'true';

		this.setState(
			{
				championPool: pool,
				championByKey,
				championImageBaseUrl: imageBaseUrl,
				championSource: source,
				randomChampions: initialRoll,
				imageLoaded: [false, false, false, false, false],
				players: savedPlayers,
				region: savedRegion,
				usePlayerPools: savedUsePools
			},
			async () => {
				this.syncUrlWithRoll();
				if(savedUsePools && this.allPlayersFilled(savedPlayers)){
					await this.loadPlayerPools(savedPlayers, savedRegion);
				}
			}
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
				return { id: key, key: c.key, name: c.name, image: c.image.full };
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

	readPlayersFromStorage(){
		try{
			const raw = localStorage.getItem('players');
			if(!raw) return ['', '', '', '', ''];
			const parsed = JSON.parse(raw);
			if(!Array.isArray(parsed) || parsed.length !== 5) return ['', '', '', '', ''];
			return parsed.map((p) => (p || '').toString());
		}catch(_e){
			return ['', '', '', '', ''];
		}
	}

	allPlayersFilled(players){
		return Array.isArray(players) && players.length === 5 && players.every((p) => (p || '').trim().length > 0);
	}

	onPlayerChange(index, value){
		const players = this.state.players.slice();
		players[index] = value;
		this.setState({ players });
	}

	onRegionChange(e){
		this.setState({ region: e.target.value });
	}

	toggleUsePlayerPools(checked){
		this.setState({ usePlayerPools: checked });
	}

	async saveTeam(e){
		e.preventDefault();
		const players = this.state.players.map((p) => (p || '').trim());
		const region = this.state.region;
		const usePlayerPools = !!this.state.usePlayerPools;

		if(!this.allPlayersFilled(players)){
			this.setState({ poolsError: 'Please enter 5 summoner names.' });
			return;
		}

		localStorage.setItem('players', JSON.stringify(players));
		localStorage.setItem('region', region);
		localStorage.setItem('usePlayerPools', String(usePlayerPools));

		this.setState({ poolsError: '' });

		if(usePlayerPools){
			await this.loadPlayerPools(players, region);
		}else{
			this.setState({ playerPools: [null, null, null, null, null] });
		}

		this.toggleModal('');
	}

	async loadPlayerPools(players, region){
		this.setState({ poolsLoading: true, poolsError: '' });
		try{
			const pools = await Promise.all(
				players.map(async (name) => {
					const summoner = await fetchSummonerByName({ region, name });
					const puuid = summoner && summoner.puuid ? summoner.puuid : null;
					if(!puuid) throw new Error(`Could not resolve ${name}`);
					const mastery = await fetchChampionMasteryByPuuid({ region, puuid });
					const list = Array.isArray(mastery) ? mastery : [];

					const champs = [];
					const seen = new Set();
					for(const m of list){
						const id = m && m.championId != null ? String(m.championId) : null;
						if(!id) continue;
						const c = this.state.championByKey[id];
						if(c && !seen.has(c.id)){
							seen.add(c.id);
							champs.push(c);
						}
					}
					return champs;
				})
			);

			const missing = pools.findIndex((p) => !Array.isArray(p) || p.length === 0);
			if(missing !== -1){
				throw new Error(`No champions found for player ${missing + 1}.`);
			}

			this.setState({ playerPools: pools, poolsLoading: false, poolsError: '' });
		}catch(e){
			this.setState({
				playerPools: [null, null, null, null, null],
				poolsLoading: false,
				poolsError: e && e.message ? e.message : 'Failed to load pools.'
			});
		}
	}

	getPoolForIndex(index){
		if(this.state.usePlayerPools){
			const p = this.state.playerPools[index];
			if(Array.isArray(p) && p.length > 0) return p;
		}
		return this.state.championPool;
	}

	render() {
		let { randomChampions, showModal, championImageBaseUrl, lockedSlots, championSource, toast, imageLoaded } = this.state;
		const teamLabel = this.state.players.filter((p) => (p || '').trim()).length ? `Players ${this.state.players.filter((p) => (p || '').trim()).length}/5` : '';
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
					championSource={championSource}
					teamLabel={teamLabel}
					poolsEnabled={!!this.state.usePlayerPools}
					onTeamClick={() => this.toggleModal('team')}
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
					showModal === 'team' &&
					<Modal showModal={showModal} onClick={() => this.toggleModal('')}>
						<TeamSetup
							players={this.state.players}
							region={this.state.region}
							onPlayerChange={this.onPlayerChange}
							onRegionChange={this.onRegionChange}
							onSave={this.saveTeam}
							loading={this.state.poolsLoading}
							error={this.state.poolsError}
							usingPools={this.state.usePlayerPools}
							onTogglePools={this.toggleUsePlayerPools}
						/>
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
		return {id: element.id, key: element.key, name: element.name, image: element.image}
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
		const pool = this.getPoolForIndex(index);
		
		let attempts = 0;
		while(((newChamp && currChamp && newChamp.id === currChamp.id) || this.someChampIsSame(randomChampions, newChamp)) && attempts < 500){
			newChamp = this.rollChampion(pool)
			attempts++;
		}
		if(!newChamp) return;
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
		let uniquenessFailed = false;
		for(let i=0;i<5;i++){
			if(lockedSlots[i]) continue;
			const pool = this.getPoolForIndex(i);
			let candidate = null;
			let attempts = 0;
			while(attempts < 500){
				const c = this.rollChampion(pool);
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
			}else{
				// If we can't keep uniqueness (small pools), still pick something so UI works.
				const fallback = this.rollChampion(pool);
				if(fallback){
					next[i] = fallback;
					imageLoaded[i] = false;
					uniquenessFailed = true;
				}
			}
		}

		this.setState({ randomChampions: next, imageLoaded, toast: uniquenessFailed ? 'Note: could not keep all champs unique with current pools.' : '' }, () => {
			this.syncUrlWithRoll();
			if(uniquenessFailed){
				window.setTimeout(() => this.setState({ toast: '' }), 2500);
			}
		});
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
