'use strict'; define('background/panel', [
	'common/chrome',
], function(
	{ tabs: Tabs, }
) {

class Panel {
	constructor({ tabs, commands, playlist, data, }) {
		this.ports = new Set;
		this.is = false;
		this.tabs = tabs;
		this.commands = commands;
		this.playlist = playlist;
		this.data = data;
		this.onTabMoved = this.onTabMoved.bind(this);
	}

	add(port) {
		console.log('panel', port);
		this.init(port);

		port.onMessage.addListener(({ type, value, }) => this[type](value));
		port.onDisconnect.addListener(() => {
			this.ports.delete(port);
			this.ports.size === 0 && this.detach();
		});
		this.ports.add(port);
		this.ports.size === 1 && this.attach();
	}

	init(port) {
		Promise.all(Array.from(this.tabs.values()).map(tab => tab.info()))
		.then(tabs => port.postMessage({ type: 'init', value: {
			windows: ((windows) => (tabs.forEach(tab => {
				!windows[tab.windowId] && (windows[tab.windowId] = { id: tab.windowId, tabs: [ ], });
				windows[tab.windowId].tabs.push(tab);
			}), windows))({ }),
			playlist: this.playlist.map(tab => tab.id),
			active: this.playlist.index,
			state: {
				playing: this.playlist.is(port => port.playing),
				looping: this.playlist.loop,
			},
		}, }));
	}

	attach() {
		this.is = true;
		chrome.tabs.onMoved.addListener(this.onTabMoved);
		chrome.tabs.onAttached.addListener(this.onTabMoved);
	}

	detach() {
		this.is = false;
		chrome.tabs.onMoved.removeListener(this.onTabMoved);
		chrome.tabs.onAttached.removeListener(this.onTabMoved);
	}

	emit(type, value) {
		if (!this.is) { return; }
		const message = { type, value, };
		this.ports.forEach(port => port.postMessage(message));
	}

	onTabMoved(id) {
		const tab = this.tabs.get(id);
		if (!tab) { return; }
		tab.info().then(info => this.emit('tab_open', info));
		this.lastSortCriterium = false;
	}

	hasPanel() {
		let count = 0;
		this.ports.forEach(port => !port.sender.tab && count++);
		return count;
	}

	tab_play(tabId) {
		console.log('tab_play', tabId);
		this.tabs.get(+tabId).play();
	}
	tab_focus(tabId) {
		console.log('tab_focus', tabId);
		Tabs.update(tabId, { active: true, }).then(() => console.log('tab focused'));
	}
	tab_close(tabId) {
		console.log('tab_close', tabId);
		Tabs.remove(tabId).then(() => console.log('tab closed'));
	}
	window_close(windowId) {
		console.log('window_close', windowId);
		const closing = [ ];
		this.tabs.forEach(tab => tab.windowId === windowId && closing.push(Tabs.remove(tab.id)));
		Promise.all(closing).then(() => console.log(closing.length +' tabs closed'));
	}
	playlist_add({ index, tabId, reference, }) {
		console.log('playlist_add', index, tabId, reference);
		this.emit('playlist_add', { index, tabId, reference, });
		this.playlist.splice(index, 0, this.tabs.get(+tabId));
	}
	playlist_seek(index) {
		console.log('playlist_seek', index);
		if (this.playlist.index === index) {
			this.tab_focus(this.playlist.get().id);
		} else {
			this.playlist.index = index;
		}
		this.commands.play();
	}
	playlist_delete(index) {
		console.log('playlist_delete', index);
		this.emit('playlist_delete', index);
		this.playlist.index === index && this.playlist.is(tab => tab.pause());
		const old = this.playlist.splice(index, 1);
		old && old.playing && this.commands.play();
	}
	playlist_sort({ by, direction, }) {
		if (!(direction > 0 || direction < 0)) {
			direction = this.lastSortCriterium === by ? -1 : 1;
		}
		console.log('playlist_sort', by, direction);
		const mapper = {
			random: Math.random,
			position: tab => tab.tab().then(info => (info.windowId << 16) + info.index),
			viewsGlobal: tab => this.data.get(tab.videoId, [ 'rating', ]).then(({ rating, }) => -rating.views),
			viewsTotal: tab => this.data.get(tab.videoId, [ 'viewed', ]).then(({ viewed, }) => -(viewed || 0)),
			viewsRelative: tab => this.data.get(tab.videoId, [ 'viewed', 'meta', ]).then(({ viewed, meta, }) => -(viewed || 0) / (meta && meta.duration || Infinity)),
		}[by];
		const data = new WeakMap;
		return Promise.all(this.playlist.map(tab => Promise.resolve(tab).then(mapper).then(value => data.set(tab, value))))
		.then((values, index) => {
			console.log('sorting by', data);
			this.playlist.sort((a, b) => (data.get(a) - data.get(b)) * direction);
			this.emit('playlist_replace', this.playlist.map(tab => tab.id));
			this.lastSortCriterium = direction === 1 && by;
		})
		.catch(error => console.error('Sorting failed', error));
	}
	command_play() { this.commands.play(); }
	command_pause() { this.commands.pause(); }
	command_next() { this.commands.next(); }
	command_prev() { this.commands.prev(); }
	command_loop() { this.commands.loop(); }
}

return Panel;

});
