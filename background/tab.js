(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/concurrent': { sleep, },
	'node_modules/es6lib/network': { HttpRequest, },
	'node_modules/es6lib/port': Port,
	'node_modules/web-ext-utils/chrome/': { Tabs, Windows, Storage, applications: { gecko, blink, }, },
	db,
}) {

const resolved = Promise.resolve();

class Tab {
	constructor({ port, playlist, panel, commands, }) {
		console.log('tab', port);
		this.id = port.sender.tab.id;
		if (Tab.instances.has(this.id)) { throw new Error('Tab with id '+ this.id +' already exists'); }
		Tab.instances.set(this.id, this);
		this.playlist = playlist;
		this.panel = panel;
		this.commands = commands;
		this.videoId = null;
		this.port = new Port(port, Port.web_ext_Port)
		.addHandlers('tab.', Tab.remoteMethods, this)
		.addHandlers('db.', db);
		this.port.ended.then(() => this.destructor());

		this.muteCount = 0;
		this.destructed = false;
	}

	destructor() {
		if (this.destructed) { return; }
		try { console.log('Tab.destructor', this.id); } catch (e) { error(e); }
		try { Tab.actives.delete(this.id); } catch (e) { error(e); }
		try { Tab.instances.delete(this.id); } catch (e) { error(e); }
		try { this.playlist.delete(this); } catch (e) { error(e); }
		try { this.panel.emit('tab_close', this.id); } catch (e) { error(e); }
		try { this.playing && this.commands.play(); } catch (e) { error(e); }
		// TODO: if this.playing && !this.active then focus the next playing tab
		try { this.port.destroy(); } catch (e) { error(e); }
		try { this.stoppedPlaying(); } catch (e) { error(e); }
		this.destructed = true;
		function error(e) { console.error(e); }
	}

	tab() {
		return Tabs.get(+this.id);
	}

	info() {
		const videoId = this.videoId, tabId = this.id;
		return Promise.all([
			this.tab().catch(error => console.error(error)),
			db.get(videoId, [ 'meta', ]).catch(error => console.error(error)),
			Tab.getThumbUrl(videoId),
		]).then(([
			{ windowId = 'other', index = -1, } = { },
			{ meta: { title = '<unknown>', duration = 0, } = { }, } = { },
			thumb,
		]) => ({
			tabId, windowId, videoId, index, title, duration, thumb,
		}));
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

	stoppedPlaying(time) {
		if (!this.playing) { return; }
		if (time !== undefined && false) { // TODO: when seeking, this is already the new time
			db.increment(this.videoId, 'viewed', time - this.playing.from);
		} else {
			db.increment(this.videoId, 'viewed', (Date.now() - this.playing.at) / 1000);
		}
		this.playing = false;
	}
	startedPlaying(time) {
		this.playing && this.stoppedPlaying(time);
		const now = Date.now();
		this.playing = { from: time, at: now, };
		db.assign(this.videoId, 'private', { lastPlayed: now, });
	}

	player_created(vId) {
		console.log('player_created', vId);
		this.stoppedPlaying();
		this.videoId = vId;
		if (!Tab.actives.has(this.id)) { Tab.actives.set(+this.id, this); }
		const added = this.playlist.add(this);
		this.panel.is && this.info().then(info => {
			this.panel.emit('tab_open', info);
			added !== -1 && this.panel.emit('playlist_add', { index: added, tabId: this.id, });
		});
	}
	player_playing(time) {
		console.log('player_playing', this.videoId, time);
		this.startedPlaying(time);
		Tab.pauseAllBut(this);
		this.panel.emit('state_change', { playing: true, });
		const added = this.playlist.seek(this);
		added !== -1 && this.panel.emit('playlist_add', { index: added, tabId: this.id, });
		(!blink || !this.panel.hasPanel()) && this.tab().then(({ windowId, }) => Windows.get(windowId))
		.then(({ focused, }) => !focused && Tabs.update(this.id, { active: true, }));
	}
	player_paused(time) {
		console.log('player_paused', this.videoId, time);
		if (!this.playing) { return; }
		this.stoppedPlaying(time);
		this.panel.is && this.panel.emit('state_change', { playing: this.playlist.is(tab => tab.playing), });
	}
	player_ended(time) {
		console.log('player_ended', this.videoId, time);
		this.stoppedPlaying(time);
		this.playlist.get() === this && this.commands.next();
		this.panel.is && this.panel.emit('state_change', { playing: this.playlist.is(tab => tab.playing), });
	}
	player_removed() {
		console.log('player_removed', this.videoId);
		this.stoppedPlaying();
		this.videoId = null;
		Tab.actives.delete(this.id);
		this.playlist.delete(this);
		this.panel.emit('tab_close', this.id);
		this.playing && this.commands.play();
	}
	reply_after(ms) {
		return sleep(ms);
	}
	mute_start() {
		console.log('mute_start', this.id);
		this.muteCount++;
		if (this.muteCount !== 1) { return; }
		return Tabs.update(+this.id, { muted: true, });
	}
	mute_stop() {
		console.log('mute_stop', this.id);
		if (this.muteCount > 0) { this.muteCount--; }
		if (this.muteCount > 0) { return; }
		return Tabs.update(+this.id, { muted: false, });
	}
	focus_temporary() {
		if (!blink) { return; }
		console.log('focus_temporary', this);
		this.tab().then(({ index, windowId, active, pinned, }) => {
			Windows.create({ tabId: this.id, state: 'minimized', })
			.then(() => Tabs.move(this.id, { index, windowId, }))
			.then(() => Tabs.update(this.id, { active, pinned, }))
			.then(() => Tabs.move(this.id, { index, windowId, }));
		});
	}
}
Tab.remoteMethods = Object.getOwnPropertyNames(Tab.prototype).filter(key => (/_/).test(key)).map(key => Tab.prototype[key]);
Tab.instances = new Map;
Tab.actives = new Map;
Tab.getThumbUrl = !db.isIDB
? videoId => `https://i.ytimg.com/vi/${ videoId }/default.jpg`
: (() => {
	const cache = new Map;
	return videoId => {
		if (cache.has(videoId)) { return cache.get(videoId); }
		const soon = db.get(videoId, [ 'thumb', ])
		.then(({ thumb: blob, }) => {
			if (blob) { return useBlob(blob); }
			const url = `https://i.ytimg.com/vi/${ videoId }/default.jpg`;
			HttpRequest(url, { responseType: 'blob', })
			.then(({ response: blob, }) => useBlob(blob, true))
			.catch(error => (console.error('Failed to fetch thumbnail:', error), cache.delete(videoId)));
			return url;
		});
		cache.set(videoId, soon);
		return soon;

		function useBlob(blob, save) {
			save && db.set(videoId, { thumb: blob,});
			const url = URL.createObjectURL(blob);
			cache.set(videoId, url);
			return url;
		}
	};
})();

function toJson(value) {
	return JSON.stringify(value, (key, value) => {
		if (!value || typeof value !== 'object') { return value; }
		if (value instanceof Error) { return '$_ERROR_$'+ JSON.stringify({ name: value.name, message: value.message, stack: value.stack, }); }
		return value;
	});
}

return Tab;

}); })();
