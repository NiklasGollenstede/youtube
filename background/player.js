(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Tabs, Windows, Storage, },
	'node_modules/web-ext-utils/browser/messages': messages,
	'node_modules/web-ext-utils/browser/version': { fennec, gecko, },
	'node_modules/web-ext-utils/loader/views': { getViews, },
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/es6lib/object': { MultiMap, assignDescriptors, },
	'node_modules/es6lib/concurrent': { sleep, },
	'common/options': options,
	content,
	Playlist,
	VideoInfo,
}) => {

/**
 * declarations
 */

const Player = { };
const players = new MultiMap, videos = new Set;
const container = global.document.head.appendChild(global.document.createElement('players'));
let current = null, duration = NaN, playing = false;
const playlist = new Playlist((await Storage.local.get('playlist')).playlist);
options.playlist.children.loop.whenChange(([ value, ]) => (playlist.loop = value));
const savePlaylist = debounce(() => Storage.local.set({ playlist: { values: Player.playlist.current, index: playlist.index, }, }), 1e4);
playlist.onAdd(savePlaylist); playlist.onRemove(savePlaylist); playlist.onSeek(savePlaylist); // TODO: split into two independent entries

/**
 * exports
 */
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
Object.freeze(Player);

/**
 * event and message handlers
 */

playlist.onSeek(() => loadPlayer(playlist.get()));
playlist.onRemove(async (index, id) => { sleep(0); playlist.get() !== id && loadPlayer(playlist.get()); });
// TODO: this also triggers if an element before the current one gets removed

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
			if (current && current.id === player.id && (current instanceof AudioPlayer))
			{ player.seekTo(current.currentTime); setCurrent(player); }
		},
		async playing() {
			// TODO: pause if tab is not focused?
			player.playing = true;
			const wasPlaying = playing; playing = true;
			current && current.id === player.id && (current instanceof AudioPlayer) && player.seekTo(current.currentTime);
			setCurrent(player);
			!wasPlaying && firePlay([ true, ]);

			// focus tab
			const { windowId, active, } = (await Tabs.get(frame.tabId));
			!active && (await windowIsIdle(windowId)) && (await Tabs.update(frame.tabId, { active: true, }));
		},
		paused() {
			player.playing = false;
			if (current !== player) { return; }
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

	port.post('start');
});

messages.addHandlers({
	reportError, // allow content to report errors
	replyAfter(ms) { return sleep(ms); }, // setTimeout doesn't work reliably in background tabs
	async   muteTab() { return void (await !fennec && Tabs.update(this.tab.id, { muted: true, })); },
	async unmuteTab() { return void (await !fennec && Tabs.update(this.tab.id, { muted: false, })); },
	async focusTabTemporary() { // in chrome (and probably other browsers) YouTube refuses to/can't play until the tab was active once
		if (gecko) { return; } // let's not do Firefox until it becomes necessary again
		const tabId = this.tab.id, { index, windowId, active, pinned, } = (await Tabs.get(tabId));
		console.log('focus_temporary', { index, windowId, active, pinned, });
		if (active) { return; } // moving the tab won't do anything positive

		// avoid moving the tab if not necessary
		if ((await windowIsIdle(windowId))) { return void (await Tabs.update(tabId, { active: true, })); } // playing the video would do this anyway
		console.log('focus_temporary the long way');

		(await Windows.create({ tabId: tabId, state: 'minimized', type: 'popup', })); // move into own window ==> focuses
		(await Tabs.move(tabId, { index, windowId, })); // move back into original window
		(await Tabs.update(tabId, { active, pinned, })); // need to pin again if it was pinned
		(await Tabs.move(tabId, { index, windowId, })); // move to the correct position within (the pinned tabs of) the window
	},
});

// report location changes to the content scripts
Tabs.onUpdated.addListener(async (tabId, { url, }) => {
	if (!url || !(await content.appliedToFrame(tabId))) { return; }
	messages.post({ tabId, }, 'navigated', url);
});

/**
 * classes
 */

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
		[ 'durationchange', 'ended', 'error', 'pause', 'playing', 'stalled', ]
		.forEach(event => this.addEventListener(event, this));
		container.appendChild(this);
	}

	handleEvent(event) { switch (event.type) {
		case 'durationchange': this.duration !== duration && fireDurationChange([ duration = this.duration, ]); break;
		case 'ended': current === this && Player.next(); current === this && this.start(); break;
		case 'error': reportError(`Audio playback error`, `reloading `+ this.title, event); this.load(); break; // TODO: this loops if .load() doesn't throw but causes another error on this
		/*case 'pause': case 'playing':*/ case 'stalled': current === this && this.playing !== playing && firePlay([ playing = this.playing, ]) ;
	} }

	async load() {
		let info = (await VideoInfo.getData(this.id));
		if (!info.audioUrl || info.error || Date.now() - info.fetched > 12e5/*20 min*/) {
			(await VideoInfo.refresh(this.id));
			info = (await VideoInfo.getData(this.id));
			if (!info.audioUrl || info.error) {
				reportError(`Failed to load audio`, `for YouTube video "${ info.title }" (${ this.id })`, info.error ? '\n'+ info.error : '');
				return;
			}
		}
		const time = this.currentTime || 0;
		this.src = info.audioUrl;
		this.volume = loundessToVolume(info.loudness);
		this.title = info.title;
		current.currentTime = time;
		current === this && this.playing !== playing && (playing ? this.play() : this.pause());
		console.log('audio loaded', this);
	}

	get playing() { return !this.paused; }
	start() { this.currentTime = 0; this.play(); }
	seekTo(value) { this.currentTime = value; }
	destroy() {
		console.log('destroyed audioPlayer', this.id);
		this.src = '';
		players.delete(this.id, this);
		[ 'durationchange', 'ended', 'error', 'pause', 'playing', 'stalled', ]
		.forEach(event => this.removeEventListener(event, this));
		this.remove();
	}
}

return Player;

/**
 * functions
 */

/// maps the relative loudness analyzed by YouTube to the appropriate playback volume
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
	if (!id) { return void setCurrent(null); }
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
		position:      async id => {
			const frame = Player.frameFor(id); if (!frame) { return 0; }
			const info = (await Tabs.get(frame.tabId)); return (info.windowId << 16) + info.index;
		},
		viewsGlobal:   async id => { const data = (await VideoInfo.getData(id)); return -(data.views); },
		viewsDuration: async id => { const data = (await VideoInfo.getData(id)); return -(data.viewed || 0); },
		viewsTimes:    async id => { const data = (await VideoInfo.getData(id)); return -(data.viewed || 0) / (data.duration || Infinity); },
	}[by];
	const data = new Map/*<videoId, number>*/, position = new Map/*<videoId, index>*/;
	(await Promise.all(playlist.map(
		(id, index) => Promise.resolve(id).then(mapper)
		.catch(error => (console.error(error), 0))
		.then(value => data.set(id, value || 0) === position.set(id, index)) // add the previous index to make the sorting stable
	)));
	const current = playlist.get();
	const sorted = playlist.slice().sort((a, b) => ((data.get(a) - data.get(b)) || (position.get(a) - position.get(b))) * direction); // sort a .slice() to avoid updates
	const reverse = !directed && playlist.every((tab, index) => tab === sorted[index]); // reverse if nothing changed
	playlist.splice(0, Infinity, ...(reverse ? sorted.reverse() : sorted)); // write change
	playlist.index = playlist.indexOf(current);
}

/// returns true, if a tab in the window can be activated without interrupting the user because the window is actively used
async function windowIsIdle(windowId) {
	if (fennec) { return false; } // only one "window"
	if (hasFocusedSidebar()) { return true; }
	if (gecko) { return hasPanel() || hasFocusedSidebar() || !(await hasFocus()); }
	return !(await hasFocus()) && !hasPanel();

	function hasFocus() { return Windows.get(windowId).then(_=>_.focused); }
	function hasPanel() { return getViews().some(_=>_.type === 'panel'); }
	function hasFocusedSidebar() { return getViews().some(_=>_.type === 'sidebar' && _.view.document.hasFocus()); }
}

}); })(this);
