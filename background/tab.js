'use strict'; define('background/tab', [
	'common/chrome',
], function(
	{ tabs: Tabs, }
) {

class Tab {
	constructor({ port, playlist, panel, commands, data, }) {
		console.log('tab', port);
		this.id = port.sender.tab.id;
		if (Tab.instances.has(this.id)) { throw new Error('Tab with id '+ this.id +' already exists'); }
		Tab.instances.set(this.id, this);
		this.port = port;
		this.playlist = playlist;
		this.panel = panel;
		this.commands = commands;
		this.data = data;
		this.videoId = null;

		port.onMessage.addListener(message => {
			if (this.destructed) { return; }
			const { name, id } = message;
			if (id) {
				this.data[name](...message.args).then(
					value => this.postMessage({ name, value, id: id, }),
					error => this.postMessage({ name, error, id: id, })
				);
			} else {
				this[name](message.value);
			}
		});
		port.onDisconnect.addListener(() => this.destructor());

		this.pingCount = 0;
		this.pingInterval = 25;
		this.pingId = -1;
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
		try { this.port.disconnect(); } catch (e) { error(e); }
		try { clearInterval(this.pingId); } catch (e) { error(e); }
		this.playing = false;
		this.destructed = true;
		function error(e) { console.error(e); }
	}

	tab() {
		return Tabs.get(+this.id);
	}

	info() {
		const videoId = this.videoId, tabId = this.id;
		return Promise.all([
			this.tab(),
			this.data.get(videoId, [ 'meta', ]),
		]).then(([
			{ id, windowId, index, },
			{ meta: { title, duration, }, },
		]) => ({
			tabId, windowId, videoId, index, title, duration,
		}));
	}

	emit(name, value) {
		this.postMessage({ name, value, });
	}

	postMessage(message) {
		try {
			this.port.postMessage(message);
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
		Tab.actives.forEach(tab => tab.playing && tab !== exclude && tab.pause());
	}

	ping() {
		this.emit('ping');
	}

	player_created(vId) {
		console.log('player_created', vId);
		this.videoId = vId;
		if (!Tab.actives.has(this.id)) { Tab.actives.set(+this.id, this); }
		const added = this.playlist.add(this);
		this.panel.is && this.info().then(info => {
			this.panel.emit('tab_open', info);
			added !== -1 && this.panel.emit('playlist_add', { index: added, tabId: this.id, });
		});
	}
	player_playing(vId) {
		console.log('player_playing', vId);
		this.playing = true;
		Tab.pauseAllBut(this);
		this.panel.emit('state_change', { playing: true, });
		const added = this.playlist.seek(this);
		added !== -1 && this.panel.emit('playlist_add', { index: added, tabId: this.id, });
	}
	player_paused(vId) {
		console.log('player_paused', vId);
		if (!this.playing) { return; }
		this.playing = false;
		this.panel.is && this.panel.emit('state_change', { playing: this.playlist.is(tab => tab.playing), });
	}
	player_ended(vId) {
		console.log('player_ended', vId);
		this.playing = false;
		this.playlist.get() === this && this.commands.next();
		this.panel.is && this.panel.emit('state_change', { playing: this.playlist.is(tab => tab.playing), });
	}
	player_removed() {
		console.log('player_removed', this.videoId);
		this.videoId = null;
		Tab.actives.delete(this.id);
		this.playlist.delete(this);
		this.panel.emit('tab_close', this.id);
		this.playing && this.commands.play();
		this.playing = false;
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
Tab.instances = new Map;
Tab.actives = new Map;

return Tab;

});
