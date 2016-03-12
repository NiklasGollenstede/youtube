'use strict';

const Tabs = require('common/chrome').tabs;

// init options
chrome.storage.local.get('defaultOptions', ({ defaultOptions, }) => /*defaultOptions ||*/ chrome.storage.local.set({ defaultOptions: require('options/defaults'), }));
chrome.storage.sync.get('options', ({ options, }) => /*options ||*/ chrome.storage.sync.set({ options: require('options/utils').simplify(require('options/defaults')), }));

const tabs = new Map;
let panel = null;
const playlist = new (require('background/playlist'))({
	onSeek(index) {
		console.log('onSeek', index);
		panel && panel.emit('playlist_seek', index);
	},
});

const commands = {
	play() {
		Tab.pauseAllBut(playlist.get());
		playlist.is(tab => tab.play());
	},
	pause() {
		Tab.pauseAllBut(null);
	},
	toggle() {
		const tab = playlist.get();
		tab && !tab.playing ? commands.play() : commands.pause();
	},
	next() {
		playlist.next() ? commands.play() : commands.pause();
	},
	prev() {
		playlist.prev() ? commands.play() : commands.pause();
	},
	loop(value = !playlist.loop) {
		playlist.loop = !!value;
		panel && panel.emit('state_change', { looping: playlist.loop, });
	},
};

class Panel {
	constructor(port) {
		console.log('panel', port);
		this.port = port;
		panel = this;

		port.onMessage.addListener(({ type, args, }) => (this)[type](...args));
		port.onDisconnect.addListener(() => panel = null);

		this.init();
	}

	emit(type, ...args) {
		this.port.postMessage({ type, args, });
	}

	init() {
		Promise.all(Array.from(tabs.values()).map(tab => tab.info()))
		.then(tabs => this.emit('init', {
			windows: ((windows) => (tabs.forEach(tab => {
				!windows[tab.windowId] && (windows[tab.windowId] = { id: tab.windowId, tabs: [ ], });
				windows[tab.windowId].tabs.push(tab);
			}), windows))({ }),
			playlist: playlist.map(tab => tab.id),
			active: playlist.index,
			state: {
				playing: playlist.is(port => port.playing),
				looping: playlist.loop,
			},
		}));
	}

	tab_focus(tabId) {
		console.log('tab_focus', tabId);
		Tabs.update(tabId, { highlighted: true, }).then(() => console.log('tab focused'));
	}
	playlist_add(index, tabId) {
		console.log('playlist_add', index, tabId);
		playlist.insertAt(index, tabs.get(tabId));
	}
	playlist_seek(index) {
		console.log('playlist_seek', index);
		playlist.index = index;
		commands.play();
	}
	playlist_delete(index) {
		console.log('playlist_delete', index);
		const old = playlist.deleteAt(index);
		old && old.playing && commands.play();
	}
	command_play() { commands.play(); }
	command_pause() { commands.pause(); }
	command_next() { commands.next(); }
	command_prev() { commands.prev(); }
	command_loop() { commands.loop(); }
}

class Tab {
	constructor(port) {
		console.log('tab', port);
		this.port = port;
		this.id = port.sender.tab.id;
		this.windowId = port.sender.tab.windowId;

		port.onMessage.addListener(({ type, args, }) => (this)[type](...args));
		port.onDisconnect.addListener(() => this.remove());
	}

	tab() {
		return Tabs.get(this.id);
	}

	info() {
		return this.tab().then(({ id, windowId, url, index, title, }) => {
			const videoId = url.match(/(?:v=)([\w-_]{11})/)[1];
			return {
				tabId: id, windowId, videoId, index, title: title.replace(/ *-? ?YouTube$/i, ''),
			};
		});
	}

	emit(type, ...args) {
		this.port.postMessage({ type, args, });
	}

	play() {
		this.emit('play');
	}
	pause() {
		this.emit('pause');
	}
	static pauseAllBut(exclude) {
		tabs.forEach(tab => tab !== exclude && tab.pause());
	}

	insert() {
		console.log('add', playlist);
		tabs.set(this.id, this);
		playlist.add(this);
		panel && panel.emit('tabs_create', this.info);
	}

	remove() {
		console.log('delete', playlist);
		tabs.delete(this.id);
		playlist.delete(this);
		panel && panel.emit('tabs_close', this.id);
		this.playing && commands.play();
		this.playing = false;
	}

	player_created(vId) {
		console.log('player_created', vId);
		if (!tabs.has(this.id)) { this.insert(); }
	}
	player_playing(vId) {
		console.log('player_playing', vId);
		if (!tabs.has(this.id)) { this.insert(); }
		this.playing = true;
		Tab.pauseAllBut(this);
		playlist.seek(this);
		panel && panel.emit('state_change', { playing: true, });
	}
	player_videoCued(vId) {
		console.log('player_videoCued', vId);
		if (!tabs.has(this.id)) { this.insert(); }
		else { panel && panel.emit('tabs_update', this.info); }
	}
	player_paused(vId) {
		console.log('player_paused', vId);
		if (!tabs.has(this.id)) { this.insert(); }
		this.playing = false;
		panel && panel.emit('state_change', { playing: playlist.is(tab => tab.playing), });
	}
	player_ended(vId) {
		console.log('player_ended', vId);
		this.playing = false;
		commands.next();
		panel && panel.emit('state_change', { playing: playlist.is(tab => tab.playing), });
	}
	player_removed() {
		console.log('player_removed');
		this.remove();
	}
}

chrome.commands.onCommand.addListener(command => ({
	MediaPlayPause: commands.toggle,
	MediaNextTrack: commands.next,
	MediaPrevTrack: commands.prev,
}[command]()));

chrome.runtime.onConnect.addListener(port => port.sender.tab ? new Tab(port) : new Panel(port));
