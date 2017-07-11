(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Tabs, Storage, },
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/es6lib/object': { MultiMap, assignDescriptors, },
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	'common/options': options,
	content,
	Playlist,
	VideoInfo,
}) => {

const Player = { };
const players = new MultiMap, videos = new Set;
let current = null, duration = NaN, playing = false;
const playlist = new Playlist((await Storage.local.get('playlist')).playlist);
options.playlist.children.loop.whenChange(([ value, ]) => (playlist.loop = value));
const savePlaylist = debounce(() => Storage.local.set({ playlist: { values: Player.playlist.current, index: playlist.index, }, }), 1e4);
playlist.onAdd(savePlaylist); playlist.onRemove(savePlaylist); playlist.onSeek(savePlaylist); // TODO: split into two independent entries

const fireVideoOpen = setEvent(Player, 'onVideoOpen', { lazy: false, }); // (id)
const fireVideoClose = setEvent(Player, 'onVideoClose', { lazy: false, }); // (id)
const firePlay = setEvent(Player, 'onPlay', { lazy: false, }); // (bool)
const fireDurationChange = setEvent(Player, 'onDurationChange', { lazy: false, }); // (bool)

assignDescriptors(Player, {
	async getOpenVideos(sortBy) {
		void sortBy; // TODO: sort
		return Array.from(videos, _=>_.id);
	},
	get current() { return current && current.id; },
	set current(value) { if (!value) { setCurrent(null); } else { setCurrent(loadPlayer(value)); } },
	get playing() { return playing; },
	get duration() { return duration; },
	get currentTime() { return current && (current instanceof AudioPlayer) ? current.currentTime : NaN; },

	play() {
		if (playing) { return; }
		if (playlist.index === Infinity || playlist.index < 0) {
			if (playlist.length) { playlist.index = 0; }
			else { return; }
		}
		playing = true; firePlay([ true, ]);
	},
	pause() {
		if (!playing) { return; }
		playing = false; firePlay([ false, ]);
	},
	toggle() {
		playing ? Player.pause() : Player.play();
	},
	start() {
		Player.play();
		current.seekTo(0);
	},
	seekTo(sec) {
		if (!current) { return; }
		current.seekTo(sec);
	},
	loop(value = !playlist.loop) {
		options.playlist.children.loop.value = playlist.loop = !!value;
	},
	next() { playlist.next(); },
	prev() { playlist.prev(); },
	playlist: Object.freeze({
		next() { playlist.next(); },
		prev() { playlist.prev(); },
		get index() { return playlist.index; }, set index(value) { playlist.index = value; },
		get current() { return Array.from(playlist); },
		splice() { return playlist.splice(...arguments); },
		onAdd: playlist.onAdd,
		onRemove: playlist.onRemove,
		onSeek: playlist.onSeek,
		sort: sortPlaylist,
	}),
	frameFor(id) {
		for (const open of players.get(id)) { if (open instanceof RemotePlayer) { return open.frame; } }
		return null;
	},
});


class RemotePlayer {
	constructor({ id, port, frame, }) {
		this.id = id; this.port = port; this.frame = frame;
		this.playing = false;
		players.add(this.id, this);
		videos.add(this);
		fireVideoOpen([ this.id, ]);
		this.duration = NaN; // const
		port.ended.then(() => this.destroy());
	}

	play() { return this.port.request('play', true); }
	pause() { return this.port.request('pause', true); }
	start() { return this.port.request('start'); }
	seekTo(v) { return this.port.request('seekTo', v); }

	destroy() {
		if (!this.port) { return; } this.port = null;
		this.playing = false;
		players.delete(this.id, this);
		videos.delete(this);
		if (current === this) {
			current = null;
			loadPlayer(this.id);
		}
		fireVideoClose([ this.id, ]);
	}
}


class AudioPlayer extends global.Audio {
	constructor(id) {
		super();
		this.id = id;
		players.add(this.id, this);
		this.load();
		this.addEventListener('durationchange', this);
		this.addEventListener('ended', this);
	}

	handleEvent(event) { switch (event.type) {
		case 'durationchange': this.duration !== duration && fireDurationChange([ duration = this.duration, ]); break;
		case 'ended': current === this && Player.next(); current === this && this.start(); break;
		case 'pause': case 'playing':  case 'stalled': current === this && this.playing !== playing && firePlay([ playing = this.playing, ]) ;
	} }

	async load() {
		const info = (await VideoInfo.getData(this.id));
		if (info.audioUrl && Date.now() - info.fetched < 12e5/*20 min*/) {
			this.src = info.audioUrl;
			this.volume = loundessToVolume(info.loudness);
		} else {
			(await VideoInfo.refresh(this.id));
			const info = (await VideoInfo.getData(this.id));
			if (!info.audioUrl) { reportError(`Failed to load audio`, `for YouTube video "${ info.title }" (${ this.id })`); }
			this.src = info.audioUrl;
			this.volume = loundessToVolume(info.loudness);
		}
		console.log('audio loaded', this);
	}

	get playing() { return !this.paused; }
	start() { this.currentTime = 0; this.play(); }
	seekTo(value) { this.currentTime = value; }
	destroy() {
		console.log('destroyed audioPlayer', this.id);
		this.src = '';
		players.delete(this.id, this);
		this.removeEventListener('durationchange', this);
		this.removeEventListener('ended', this);
	}
}

function loundessToVolume(loundess) {
	if (!(loundess > 0)) { return 1; } // default is 0, everything below is left at 100% volume by YouTube. One *could* use the WebAudio AIP to increase it above 100%
	return 0.89125 ** loundess; // used a couple of samples: it's defensively an exponential function and the base is quite close to 0.89125
}


function setCurrent(player) {
	current && current !== player && current.pause();
	current = player;
	if (!player) {
		playing && firePlay([ playing = false, ]);
		!isNaN(duration) && fireDurationChange([ duration = NaN, ]);
	} else {
		playlist.seek(player.id);
		player.duration !== duration && fireDurationChange([ duration = player.duration, ]);
		playing !== player.playing && (playing ? player.play() : player.pause());
	}
}

function loadPlayer(id) {
	if (current && current.id === id) { return; }
	for (const open of players.get(id)) { if (open instanceof RemotePlayer) { return void setCurrent(open); } }
	for (const open of players.get(id)) { return void setCurrent(open); }
	setCurrent(new AudioPlayer(id));
}

async function sortPlaylist(by, direction = 0) {
	const directed = !!(direction << 0);
	direction = directed && direction < 0 ? -1 : 1;
	console.log('playlist_sort', by, direction, directed);
	const mapper = { // must return a signed 32-bit integer
		random:        _   => Math.random() * 0xffffffff,
		position:      async tile => {
			const frame = Player.frameFor(tile.videoId); if (!frame) { return 0; }
			const info = (await Tabs.get(frame.tabId)); return (info.windowId << 16) + info.index;
		},
		viewsGlobal:   async tile => { const data = (await VideoInfo.getData(tile.videoId)); return -(data.views); },
		viewsDuration: async tile => { const data = (await VideoInfo.getData(tile.videoId)); return -(data.viewed || 0); },
		viewsTimes:    async tile => { const data = (await VideoInfo.getData(tile.videoId)); return -(data.viewed || 0) / (data.duration || Infinity); },
	}[by];
	const data = new Map; // videoId ==> number
	(await Promise.all(playlist.map(
		(tab, index) => Promise.resolve(tab).then(mapper)
		.catch(error => (console.error(error), 0))
		.then(value => data.set(tab, (value << 0) || 0) * 1024 + index) // add the previous index to make the sorting stable
	)));
	const current = playlist.get();
	const sorted = playlist.slice().sort((a, b) => (data.get(a) - data.get(b)) * direction); // sort a .slice() to avoid updates
	const reverse = !directed && playlist.every((tab, index) => tab === sorted[index]); // reverse if nothing changed
	playlist.splice(0, Infinity, ...(reverse ? sorted.reverse() : sorted)); // write change
	playlist.index = playlist.indexOf(current);
}

playlist.onSeek(index => playlist.index === Infinity || playlist.index < 0 ? setCurrent(null) : loadPlayer(playlist[index]));

Player.onPlay(playing => { if (playing) { // play
	const id = playlist.get();
	loadPlayer(id);
	current && !current.playing && current.play();
} else { // pause
	current && current.playing && current.pause();
} });

content.onMatch(async frame => {
	const port = (await frame.connect('player'));

	let player = null;

	const on = {
		created(id) {
			player = new RemotePlayer({ id, port, frame, });
		},
		playing() {
			player.playing = true;
			const wasPlaying = playing; playing = true;
			current && current.id === player.id && (current instanceof AudioPlayer) && player.seekTo(current.currentTime);
			setCurrent(player);
			!wasPlaying && firePlay([ true, ]);
		},
		paused() {
			player.playing = false;
			const wasPlaying = playing; playing = false;
			wasPlaying && firePlay([ false, ]);
		},
		ended() {
			player.playing = false;
			player === current && Player.next();
			current === this && this.start();
		},
		removed() {
			player.destroy();
			player = null;
		},
	};
	Object.keys(on).forEach(event => {
		port.post('on', event, on[event]);
		port.afterEnded('off', event, on[event]);
	});

	frame.onHide(() => { player && player.destroy(); player = null; });
});

return Object.freeze(Player);

}); })(this);
