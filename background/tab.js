(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/concurrent': { sleep, },
	'node_modules/es6lib/network': { HttpRequest, },
	'node_modules/web-ext-utils/browser/': { Tabs, Windows, },
	'node_modules/web-ext-utils/browser/version': { gecko, blink, },
	commands,
	db,
	playlist,
}) => {

let playlists; global.require([ '/views/playlist/', ], _ => (playlists = _.instances));
playlist.onRemove.addListener(tab => tab.playing && tab.pause() === commands.play());

class Tab {
	constructor({ tab, port, }) {
		console.log('tab', port);
		this.id = this.tabId = tab.id;
		this.private = tab.incognito;
		this.url = tab.url;
		this.db = this.private ? db.inMemory : db;
		if (Tab.instances.has(this.id)) { throw new Error('Tab with id '+ this.id +' already exists'); }
		Tab.instances.set(this.id, this);
		this.windowId = -1;
		this.index = -1;
		this.videoId = null;
		this.duration = 0;
		this.title = '';
		this._thumbUrl = null;
		this.port = port;
		port.addHandlers('tab.', Tab.remoteMethods, this);
		port.addHandlers('db.', this.db);
		port.ended.then(() => this.destructor());

		this.muteCount = 0;
		this.destructed = false;
	}

	destructor() {
		if (this.destructed) { return; }
		try { console.log('Tab.destructor', this.id); } catch (e) { error(e); }
		try { Tab.actives.delete(this.id); } catch (e) { error(e); }
		try { Tab.instances.delete(this.id); } catch (e) { error(e); }
		try { playlist.delete(this); } catch (e) { error(e); }
		try { Tab.onClose._fire(this.id); } catch (e) { error(e); }
		try { this.playing && commands.play(); } catch (e) { error(e); }
		// TODO: if this.playing && !this.active then focus the next playing tab
		try { this.port.destroy(); } catch (e) { error(e); }
		try { this.stoppedPlaying(); } catch (e) { error(e); }
		this.destructed = true;
		function error(e) { console.error(e); }
	}

	async tab() {
		const tab = (await Tabs.get(+this.id));
		this.windowId = tab.windowId;
		this.index = tab.index;
		return this;
	}

	play() {
		this.port.post('player.play', true);
	}
	pause() {
		this.port.post('player.pause', true);
	}
	static pauseAllBut(exclude) {
		Tab.actives.forEach(tab => tab.playing && tab !== exclude && tab.pause());
	}

	stoppedPlaying(/*time*/) {
		if (!this.playing) { return; }
		//	if (time !== undefined && false) { // TODO: when seeking, this is already the new time
		//		this.db.increment(this.videoId, 'viewed', time - this.playing.from);
		//	} else {
			this.db.increment(this.videoId, 'viewed', (Date.now() - this.playing.at) / 1000);
		//	}
		this.playing = false;
	}
	startedPlaying(time) {
		this.playing && this.stoppedPlaying(time);
		const now = Date.now();
		this.playing = { from: time, at: now, };
		this.db.assign(this.videoId, 'private', { lastPlayed: now, });
	}

	async player_created({ videoId, duration, title, }) {
		console.log('player_created', videoId, duration, title);
		this.stoppedPlaying();
		this.videoId = videoId;
		this.duration = duration;
		this.title = title;
		this._thumbUrl = null;
		if (!Tab.actives.has(this.id)) { Tab.actives.set(+this.id, this); }
		Tab.onOpen._fire(this);
		playlist.add(this, playlist.index + 1);
	}
	async player_playing(time) {
		console.log('player_playing', this.videoId, time);
		this.startedPlaying(time);
		Tab.pauseAllBut(this);
		Tab.onPlay._fire(this);
		playlist.add(this);
		playlist.seek(this);
		const hasPanel = playlists.some(view => !view.tabId);
		if (blink && hasPanel) { return; } // in chrome, focusing tabs closes all panels
		(hasPanel || !(await Windows.get((await this.tab()).windowId)).focused)
		&& (await Tabs.update(this.id, { active: true, })); // in firefox, the window is focused even if it has a panel open
	}
	player_paused(time) {
		console.log('player_paused', this.videoId, time);
		if (!this.playing) { return; }
		this.stoppedPlaying(time);
		Tab.onPlay._fire(playlist.is(tab => tab.playing) ? playlist.get() : null);
	}
	player_ended(time) {
		console.log('player_ended', this.videoId, time);
		this.stoppedPlaying(time);
		playlist.get() === this && commands.next(true);
		Tab.onPlay._fire(playlist.is(tab => tab.playing) ? playlist.get() : null);
	}
	player_removed() {
		console.log('player_removed', this.videoId);
		this.stoppedPlaying();
		this.videoId = null;
		this.duration = 0;
		this.title = '';
		this._thumbUrl = null; // TODO: should revoke
		Tab.actives.delete(this.id);
		playlist.delete(this);
		Tab.onClose._fire(this.id);
		this.playing && commands.play();
	}
	reply_after(ms) {
		return sleep(ms);
	}
	async mute_start() {
		console.log('mute_start', this.id);
		this.muteCount++;
		if (this.muteCount !== 1) { return; }
		return void (await Tabs.update(+this.id, { muted: true, }));
	}
	async mute_stop() {
		console.log('mute_stop', this.id);
		if (this.muteCount > 0) { this.muteCount--; }
		if (this.muteCount > 0) { return; }
		return void (await Tabs.update(+this.id, { muted: false, }));
	}
	async focus_temporary() {
		const { index, windowId, active, pinned, } = (await this.tab());
		console.log('focus_temporary', { index, windowId, active, pinned, });
		if (active) { return; } // moving the tab won't do anything positive

		if (gecko) { // avoid moving the tab in firefox (takes much longer and looks worse than in chrome)
			const { focused, } = (await Windows.get(windowId));
			if (!focused) { // the tab would be focused anyway once it starts playing, and in firefox this keeps panels open
				return void (await Tabs.update(this.id, { active: true, }));
			}
			if (playlists.some(view => !view.tabId)) { // the focus is actually on the panel
				const current = (await Tabs.query({ active: true, windowId, }));
				(await Tabs.update(this.id, { active: true, }));
				(await Tabs.update(current.id, { active: true, }));
				return;
			}
		}

		(await Windows.create({ tabId: this.id, state: 'minimized', })); // move into own window ==> focuses
		gecko && (await sleep(1)); // firefox at least up to version 51 needs these
		(await Tabs.move(this.id, { index, windowId, })); // move back into original window
		gecko && (await sleep(1)); // firefox at least up to version 51 needs these
		(await Tabs.update(this.id, { active, pinned, })); // need to pin again if it was pinned
		gecko && (await sleep(1)); // firefox at least up to version 51 needs these
		(await Tabs.move(this.id, { index, windowId, })); // move to the correct position within (the pinned tabs of) the window
	}

	get thumbUrl() {
		return `https://i.ytimg.com/vi/${ this.videoId }/default.jpg`;
	}

	getThumbUrl() {
		if (this._thumbUrl) { return this._thumbUrl; }
		if (!this.private && !this.db.isIDB) {
			return (this._thumbUrl = `https://i.ytimg.com/vi/${ this.videoId }/default.jpg`);
		}
		return (this._thumbUrl = db.get(this.videoId, [ 'thumb', ])
		.then(({ thumb: blob, }) => {
			if (blob) { return (this._thumbUrl = URL.createObjectURL(blob)); }
			const url = `https://i.ytimg.com/vi/${ this.videoId }/default.jpg`;
			HttpRequest(url, { responseType: 'blob', })
			.then(({ response: blob, }) => {
				db.set(this.videoId, { thumb: blob, });
				return (this._thumbUrl = URL.createObjectURL(blob));
			}).catch(error => {
				console.error('Failed to fetch thumbnail:', error);
				return (this._thumbUrl = null);
			});
			return url;
		}));
	}
}
Tab.remoteMethods = Object.getOwnPropertyNames(Tab.prototype).filter(key => (/_/).test(key)).map(key => Tab.prototype[key]);
Tab.instances = new Map;
Tab.actives = new Map;
Tab.onOpen = new Event;
Tab.onClose = new Event;
Tab.onPlay = new Event;

return Tab;

function Event() {
	const listeners = new Set;
	return {
		_listeners: listeners,
		_fire() {
			listeners.forEach(listener => { try { listener.apply(null, arguments); } catch (error) { console.error(error); } });
		},
		addListener(listener, { owner, } = { }) {
			if (typeof listener !== 'function') { return; }
			listeners.add(listener);
			owner && owner.addEventListener('unload', () => listeners.delete(listener));
		},
		hasListener(listener) { return listeners.has(listener); },
		removeListener(listener) { listeners.delete(listener); },
	};
}

}); })(this);
