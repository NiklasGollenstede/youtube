(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/chrome/': { Tabs, Windows, },
	db,
}) {

class PanelHandler {
	constructor({ tabs, commands, playlist, }) {
		this.ports = new Set;
		this.is = false;
		this.tabs = tabs;
		this.commands = commands;
		this.playlist = playlist;
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
		Tabs.onMoved     && Tabs.onMoved   .addListener(this.onTabMoved);
		Tabs.onAttached  && Tabs.onAttached.addListener(this.onTabMoved);
	}

	detach() {
		this.is = false;
		Tabs.onMoved    && Tabs.onMoved   .removeListener(this.onTabMoved);
		Tabs.onAttached && Tabs.onAttached.removeListener(this.onTabMoved);
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
		Tabs.get(tabId).then(({ windowId, }) => Windows.update(windowId, { focused: true, })).then(() => console.log('window focused'));
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
	playlist_push(tabIds) {
		console.log('playlist_push', tabIds);
		this.emit('playlist_push', tabIds);
		this.playlist.push(...tabIds.map(tabId => this.tabs.get(+tabId)));
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
	playlist_clear() {
		console.log('playlist_clear');
		this.emit('playlist_clear');
		this.commands.pause();
		this.playlist.splice(0, Infinity);
	}
	playlist_sort({ by, direction = 0, }) {
		const before = direction === 0 && this.playlist.slice();
		console.log('playlist_sort', by, direction, before);
		const mapper = {
			random:        tab => Math.random(),
			position:      tab => tab.tab().then(info => (info.windowId << 16) + info.index),
			viewsGlobal:   tab => db.get(tab.videoId, [ 'rating', ]).then(({ rating, }) => -rating.views),
			viewsDuration: tab => db.get(tab.videoId, [ 'viewed', ]).then(({ viewed, }) => -(viewed || 0)),
			viewsTimes:    tab => db.get(tab.videoId, [ 'viewed', 'meta', ]).then(({ viewed, meta, }) => -(viewed || 0) / (meta && meta.duration || Infinity)),
		}[by];
		const data = new WeakMap; // Tab ==> number
		return Promise.all(this.playlist.map(
			tab => Promise.resolve(tab).then(mapper)
			.catch(error => (console.error(error), 0))
			.then(value => data.set(tab, +value || 0))
		))
		.then(() => {
			this.playlist.sort((a, b) => (data.get(a) - data.get(b)) * direction);
			if (before && this.playlist.every((tab, index) => tab === before[index])) {
				this.playlist.reverse();
			}
			this.emit('playlist_replace', this.playlist.map(tab => tab.id));
		})
		.catch(error => console.error('Sorting failed', error));
	}
	command_play() { this.commands.play(); }
	command_pause() { this.commands.pause(); }
	command_next() { this.commands.next(); }
	command_prev() { this.commands.prev(); }
	command_loop() { this.commands.loop(); }
}

return PanelHandler;

}); })();