(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Tabs, },
	'node_modules/web-ext-utils/loader/views': { getViews, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/es6lib/object': { MultiMap, },
	utils: { windowIsIdle, },
	content,
	Playlist,
	VideoInfo,
}) => {

/**
 * declarations
 */

const players = new MultiMap, videos = new Set;
const container = global.document.head.appendChild(global.document.createElement('players'));
let current = null, duration = NaN, playing = false;

/**
 * exports
 */
const Player = {
	getOpenVideos() {
		return Array.from(videos, ({ id: videoId, frame: { tabId, }, })=> ({ videoId, tabId, }));
	},
	get current() { return current && current.id; },
	set current(value) { if (!value) { setCurrent(null); } else { setCurrent(loadPlayer(value)); } },
	get playing() { return playing; },
	get duration() { return duration; },
	get currentTime() { return current && (current instanceof AudioPlayer) ? current.currentTime : NaN; },

	play() {
		if (playing) { return; }
		if (Playlist.index === Infinity || Playlist.index < 0) {
			if (Playlist.length) { Playlist.index = 0; }
			else { return; }
		}
		playing = true; firePlay([ true, ]);
	},
	pause() {
		if (!playing) { return; }
		playing = false; firePlay([ false, ]);
	},
	toggle() { playing ? Player.pause() : Player.play(); },
	start() { Player.play(); Player.seekTo(0); },
	seekTo(sec) { current && current.seekTo(sec); },
	next() { Playlist.length === 1 ? current && current.seekTo(0) : Playlist.next(); },
	prev() { current && current.currentTime > 5 ? current.seekTo(0) : Playlist.length === 1 ? current && current.seekTo(0) : Playlist.prev(); },
	loop(value = !Playlist.loop) { Playlist.loop = value; },
	playlist: Playlist, Playlist,
	frameFor(id) { for (const open of players.get(id)) {
		if (open instanceof RemotePlayer) { return open.frame; }
	} return null; },
};

const fireVideoOpen = setEvent(Player, 'onVideoOpen', { lazy: false, }); // (id)
const fireVideoClose = setEvent(Player, 'onVideoClose', { lazy: false, }); // (id)
const firePlay = setEvent(Player, 'onPlay', { lazy: false, }); // (bool)
const fireSeek = debounce(setEvent(Player, 'onSeek', { lazy: false, }), 500); // (void)
const fireDurationChange = setEvent(Player, 'onDurationChange', { lazy: false, }); // (bool)
Object.freeze(Player);

/**
 * event and message handlers
 */

Playlist.onSeek(() => loadPlayer(Playlist.get()));

Player.onPlay(async playing => { if (!playing) { // pause
	current && current.playing && current.pause();
} else { // play
	loadPlayer(Playlist.get());
	current && !current.playing && current.play();
} });

content.onMatch(async frame => {
	const port = (await frame.connect('player')); frame.onUnload(() => port.destroy());
	console.log('player', frame);
	port.post('on', 'created', onCreated); port.afterEnded('off', 'created', onCreated);
	function onCreated(id) { new RemotePlayer({ id, port, frame, }); }
	port.post('start');
});

/**
 * classes
 */

class RemotePlayer {
	constructor({ id, port, frame, }) {
		this.id = id; this.port = port; this.frame = frame;
		console.log('RemotePlayer', this);
		this.playing = false;
		players.add(this.id, this);
		videos.add(this);
		fireVideoOpen([ { videoId: this.id, tabId: frame.tabId, }, ]);
		this.duration = NaN; // const
		if (current && current.id === this.id && (current instanceof AudioPlayer))
		{ this.seekTo(current.currentTime); setCurrent(this); }
		port.request('playing').then(_=>_ && on.playing(_));

		const on = this.handlers = {
			playing: async () => {
				this.playing = true;
				const wasPlaying = playing; playing = true;
				current && current.id === this.id && (current instanceof AudioPlayer) && this.seekTo(current.currentTime);
				setCurrent(this);
				!wasPlaying && firePlay([ true, ]);
			},
			paused: () => {
				this.playing = false;
				if (current !== this) { return; }
				const wasPlaying = playing; playing = false;
				wasPlaying && firePlay([ false, ]);
			},
			ended: () => {
				this.playing = false;
				this === current && Player.next();
			},
			removed: () => {
				this.destroy();
			},
		};
		Object.keys(on).forEach(event => {
			port.post('on', event, on[event]);
			port.afterEnded('off', event, on[event]);
		});
		port.ended.then(on.removed);
	}

	play() { return this.port.request('play', true)/*.then(() => (this.playing = true))*/; }
	pause() { return this.port.request('pause', true); }
	start() { return this.port.request('start'); }
	seekTo(v) { return this.port.request('seekTo', v); }

	destroy() {
		if (!this.port) { return; }
		const on = this.handlers; this.port.ended !== true && Object.keys(on).forEach(event => this.port.post('off', event, on[event]));
		const frame = this.frame; this.port = null; this.frame = null; this.playing = false;
		players.delete(this.id, this);
		videos.delete(this);
		if (current === this) {
			current = null;
			loadPlayer(this.id);
		}
		fireVideoClose([ { videoId: this.id, tabId: frame.tabId, }, ]);
	}
}

class AudioPlayer extends global.Audio {
	constructor(id) {
		super(); players.add((this.id = id), this); container.appendChild(this);
		[ 'durationchange', 'ended', 'error', 'pause', 'playing', 'stalled', ]
		.forEach(event => this.addEventListener(event, this));
		this.errored = false; this.loading = false;
		this.load();
	}

	play() { this.errored = false; super.play().catch(error => {
		if (error.name === 'AbortError') { return; } // dafuq
		handleAudioError(this, error);
	}); }

	handleEvent(event) { switch (event.type) {
		case 'durationchange': current === this && this.duration !== duration && fireDurationChange([ duration = this.duration, ]); break;
		case 'ended': this.pause(); this.currentTime = 0; current === this && Player.next(); break;
		case 'playing': this.errored = false; break;
		case 'error': handleAudioError(this); break;
		/*case 'pause': case 'playing':*/ case 'stalled': current === this && this.playing !== playing && firePlay([ playing = this.playing, ]) ;
	} }

	load(reload) { (async () => { if (this.loading) { return; } else {
		this.loading = true; // there should be a timeout for this
	} try {
		let info = !reload && (await VideoInfo.getData(this.id));
		if (!info && !info.audioUrl || info.error || Date.now() - info.fetched > 12e5/*20 min*/) {
			(await VideoInfo.refresh(this.id));
			info = (await VideoInfo.getData(this.id));
			if (!info.audioUrl || info.error) {
				notify.error(`Failed to load audio`, `for YouTube video "${ info.title }" (${ this.id })`, info.error ? '\n'+ info.error : '');
				return;
			}
		}
		const time = this.currentTime || 0;
		this.src = info.audioUrl;
		this.volume = loundessToVolume(info.loudness);
		this.title = info.title;
		current.currentTime = time;
		current === this && this.playing !== playing && (playing ? super.play() : super.pause());
		console.log('audio loaded', this);
	} finally { this.loading =  false; } })(); }

	get playing() { return !this.paused; }
	start() { this.currentTime = 0; this.play(); }
	seekTo(value) { this.currentTime = value; fireSeek([ ]); playing && this.play(); }
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

function handleAudioError(audio) {
	notify.warn(`Audio playback error`, `reloading `+ audio.title, audio.error && (audio.error.message || 'Code: '+ audio.error.code));
	if (!audio.errored) { audio.errored = true; audio.load(true); }
}

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
		Playlist.seek(player.id);
		player.duration !== duration && fireDurationChange([ duration = player.duration, ]);
		playing !== player.playing && (playing ? player.play() : player.pause());
	}
}

function loadPlayer(id) {
	if (!id) { setCurrent(null); return; }
	if (current && current.id === id) { playing && current.play(); return; }
	for (const open of players.get(id)) { if (open instanceof RemotePlayer) { setCurrent(open); return; } }
	for (const open of players.get(id)) { setCurrent(open); return; } // use the first, if any
	setCurrent(new AudioPlayer(id));
}

async function showPlayer() {
	const tab = (current instanceof RemotePlayer) ? (await Tabs.get(current.frame.tabId)) : getViews().find(_=>_.name === 'video');
	tab && (tab.view ? tab.view.document.visibilityState !== 'visible' : !tab.active) && (await windowIsIdle(tab.windowId))
	&& (await Tabs.update(tab.id || tab.tabId, { active: true, }));
}

}); })(this);
