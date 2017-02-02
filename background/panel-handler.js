(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Tabs, Windows, browserAction, },
	'common/options': options,
	db,
}) => {

class PanelHandler {
	constructor({ tabs, commands, playlist, }) {
		this.ports = new Set;
		this.is = false;
		this.tabs = tabs;
		this.commands = commands;
		this.playlist = playlist;
		this.onTabMoved = this.onTabMoved.bind(this);
		this.onMessage = this.onMessage.bind(this);
	}

	add(port) {
		console.log('panel', port);
		this.init(port);

		port.onDisconnect.addListener(() => {
			port.onMessage.removeListener(this.onMessage);
			this.ports.delete(port);
			this.ports.size === 0 && this.detach();
		});
		port.onMessage.addListener(this.onMessage);
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

	onMessage({ type, value, }) {
		if (!(/_/.test(type))) { console.error(`Panel message handlers must include a '_'`); return; }
		this[type](value);
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
	async tab_focus(tabId) {
		console.log('tab_focus', tabId);
		(await Tabs.update(tabId, { active: true, }));
		console.log('tab focused');
		const { windowId, } = (await Tabs.get(tabId));
		(await Windows.update(windowId, { focused: true, }));
		console.log('window focused');
	}
	async tab_close(tabId) {
		console.log('tab_close', tabId);
		if (Array.isArray(tabId)) {
			const count = (await Promise.all(tabId.map(tabId => Tabs.remove(tabId)))).length;
			console.log(count +' tabs closed');
		} else {
			(await Tabs.remove(tabId));
			console.log('tab closed');
		}
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
	playlist_sort({ by, direction = 0, }) { // TODO: test
		const directed = !!(direction << 0);
		direction = directed && direction < 0 ? -1 : 1;
		console.log('playlist_sort', by, direction, directed);
		const mapper = { // must return a signed 32-bit integer
			random:        _   => Math.random() * 0xffffffff,
			position:      tab => tab.tab().then(info => (info.windowId << 16) + info.index),
			viewsGlobal:   tab => db.get(tab.videoId, [ 'rating', ]).then(({ rating, }) => -rating.views),
			viewsDuration: tab => db.get(tab.videoId, [ 'viewed', ]).then(({ viewed, }) => -(viewed || 0) * 256),
			viewsTimes:    tab => db.get(tab.videoId, [ 'viewed', 'meta', ]).then(({ viewed, meta, }) => -(viewed || 0) / (meta && meta.duration || Infinity) * 256),
		}[by];

		const data = new WeakMap; // Tab ==> number
		return Promise.all(this.playlist.map(
			(tab, index) => Promise.resolve(tab).then(mapper)
			.catch(error => (console.error(error), 0))
			.then(value => data.set(tab, (value << 0) || 0) * 1024 + index) // add the previous index to make the sorting stable
		))
		.then(() => {
			const sorted = this.playlist.slice().sort((a, b) => (data.get(a) - data.get(b)) * direction); // sort a .slice() to avoid updates
			const reverse = !directed && this.playlist.every((tab, index) => tab === sorted[index]); // reverse if nothing changed
			this.playlist.splice(0, Infinity, ...(reverse ? sorted.reverse() : sorted)); // write change and trigger update
			this.emit('playlist_replace', this.playlist.map(tab => tab.id));
		})
		.catch(error => console.error('Sorting failed', error));
	}
	command_play() { this.commands.play(); }
	command_pause() { this.commands.pause(); }
	command_toggle() { this.commands.toggle(); }
	command_next() { this.commands.next(); }
	command_prev() { this.commands.prev(); }
	command_loop() { this.commands.loop(); }

	set_theme(theme) {
		options.children.panel.children.theme.value = theme;
		browserAction.setPopup({ popup: `ui/panel/index.html?theme=${ theme }`, });
	}
}

options.children.panel.children.theme.whenChange(value => browserAction.setPopup({ popup: `/ui/panel/index.html?theme=${ value }`, }));

return PanelHandler;

}); })(this);
