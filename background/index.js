'use strict';

const Tabs = require('common/chrome').tabs;

// init options
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
		playlist.is(tab => tab.play(true));
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

		port.onMessage.addListener(({ type, value, }) => (this)[type](value));
		port.onDisconnect.addListener(() => panel = null);

		this.init();
	}

	emit(type, value) {
		this.port.postMessage({ type, value, });
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
	playlist_add({ index, tabId, }) {
		console.log('playlist_add', index, tabId);
		playlist.insertAt(index, tabs.get(tabId));
	}
	playlist_seek(index) {
		console.log('playlist_seek', index);
		if (playlist.index === index) {
			this.tab_focus(playlist.get().id);
		} else {
			playlist.index = index;
		}
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
		this.videoId = null;

		port.onMessage.addListener(({ type, value, }) => !this.destructed && (this)[type](value));
		port.onDisconnect.addListener(() => this.destructor());

		this.pingCount = 0;
		this.pingInterval = 25;
		this.pingId = -1;
		this.destructed = false;
	}

	destructor() {
		if (this.destructed) { return; }
		try { console.log('Tab.destructor', this.id); } catch (e) { }
		try { tabs.delete(this.id); } catch (e) { }
		try { playlist.delete(this); } catch (e) { }
		try { panel && panel.emit('tabs_close', this.id); } catch (e) { }
		try { this.playing && commands.play(); } catch (e) { }
		try { this.port.disconnect(); } catch (e) { }
		try { clearInterval(this.pingId); } catch (e) { }
		this.playing = false;
		this.destructed = true;
	}

	tab() {
		return Tabs.get(this.id);
	}

	info() {
		return this.tab().then(({ id, windowId, index, }) => {
			const videoId = this.videoId, tabId = this.id;
			return {
				tabId, windowId, videoId, index,
			};
		});
	}

	emit(type, value) {
		try {
			this.port.postMessage({ type, value, });
		} catch (error) { if ((/disconnected/).test(error.message)) {
			console.error('Error in emit, removing Tab instance', error);
			this.destructor();
		} else { throw error; } }
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

	insert(vId) {
		this.videoId = vId;
		if (tabs.has(this.id)) { return false; }
		console.log('add', playlist);
		tabs.set(this.id, this);
		playlist.add(this);
		panel && this.info().then(info => panel.emit('tabs_open', info));
		return true;
	}

	remove() {
		this.videoId = null;
		console.log('delete', playlist);
		tabs.delete(this.id);
		playlist.delete(this);
		panel && panel.emit('tabs_close', this.id);
		this.playing && commands.play();
		this.playing = false;
	}

	ping() {
		this.emit('ping');
	}

	player_created(vId) {
		console.log('player_created', vId);
		this.insert(vId);
	}
	player_playing(vId) {
		console.log('player_playing', vId);
		this.insert(vId);
		this.playing = true;
		Tab.pauseAllBut(this);
		playlist.seek(this);
		panel && panel.emit('state_change', { playing: true, });
	}
	player_videoCued(vId) {
		console.log('player_videoCued', vId);
		!this.insert(vId)
		&& panel && panel.emit('tabs_update', this.info);
	}
	player_paused(vId) {
		console.log('player_paused', vId);
		this.insert(vId);
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
	ping_start() {
		this.pingCount++;
		if (this.pingCount !== 1) { return; }
		this.pingId = setInterval(this.ping.bind(this), this.pingInterval);
	}
	ping_stop() {
		if (this.pingCount > 0) { this.pingCount--; }
		if (this.pingCount > 0) { return; }
		clearInterval(this.pingId);
		this.pingId = -1;
	}
}

chrome.commands.onCommand.addListener(command => ({
	MediaPlayPause: commands.toggle,
	MediaNextTrack: commands.next,
	MediaPrevTrack: commands.prev,
}[command]()));

chrome.runtime.onConnect.addListener(port => port.sender.tab ? new Tab(port) : new Panel(port));

Tabs.query({ }).then(tabs => {
	console.log(tabs);
	const { js, css, } = chrome.runtime.getManifest().content_scripts[0];
	Promise.all(tabs.map(({ id, }) =>
		Tabs.executeScript(id, { file: './content/cleanup.js', })
		.then(() => {
			css.forEach(file => chrome.tabs.insertCSS(id, { file: './'+ file, }));
			js.forEach(file => chrome.tabs.executeScript(id, { file: './'+ file, }));
			return true;
		})
		.catch(error => console.log('skipped tab', error)) // not allowed to execute, i.e. not YouTube
	)).then(success => console.log('attached to', success.filter(x=>x).length, 'tabs'));
});
