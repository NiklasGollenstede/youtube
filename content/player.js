(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/chrome/': { extension, applications: { gecko, }, },
	'node_modules/es6lib/concurrent': { async, spawn, sleep, Resolvable, PromiseCapability, },
	'node_modules/es6lib/dom':  { createElement, DOMContentLoaded, RemoveObserver, getParent, },
	'node_modules/es6lib/network': { HttpRequest, },
	'node_modules/es6lib/object': { Class, },
	'node_modules/es6lib/port': Port,
	'node_modules/es6lib/string': { QueryObject, },
	'common/event-emitter': EventEmitter,
	Templates,
	'./player.js': playerJS,
}) { /* globals WheelEvent */

const fadeIn_factor = 1.4, fadeIn_margin = 0.05;

let Instance = null;

// table of public members, which all remotely call methods in ./player.js.js
const methods = [
	'setQuality',
	'getQuality',
	'setSpeed',
	'getSpeed',
	'play',
	'pause',
	'end',
	'stop',
	'start',
	'next',
	'previous',
	'seekTo',
	'togglePlayPause',
	'volume',
	'mute',
	'unMute',
	'toggleMute',

	'isMuted',
	'getTime',
	'getLoaded',
	'showVideoInfo',
	'hideVideoInfo',
];

const Player = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function(main) {
		if (Instance) { try { Private(Instance).destroy(); } catch (_) { } }
		Super.call(this);
		const self = Private(this), _this = Protected(this);

		self.main = main;
		self.queue = [ ]; // [ name, args, promise, ] queue of calls meant for the player while it is not loaded yet
		self.suspended = [ ]; // stack of players that already existed when a new one showed up
		this.video = self.video = null; // the current <video> element
		this.root = self.root = null; // the current root element of the html5-video-player
		self.removePlayer = self.removePlayer.bind(self);

		// inject unsafe script
		const getPort = new Resolvable;
		const frame = self.commFrame = document.documentElement.appendChild(createElement('iframe', { style: { display: 'none', }, }));
		frame.contentWindow.addEventListener('message', event => {
			console.log('frame', event);
			self.port = new Port(event.ports[0], Port.MessagePort);
			self.port.addHandler('emit', _this.emitSync, _this);
			getPort.resolve();
			// frame.remove(); // removing the iframe would close the channel
		});
		document.documentElement.appendChild(createElement('script', { textContent: playerJS, })).remove();

		Promise.all([ getPort, self.main.promise('observerCreated'), ]).then(() => {
			self.main.observer.all('.html5-video-player', self.initPlayer.bind(self));
			self.main.observer.all('#watch7-player-age-gate-content', self.loadExternalPlayer.bind(self, { reason: 'age', }));
		});

		Instance = this;
		main.once(Symbol.for('destroyed'), () => self.destroy());
	}),

	public: Private => {
		const members = { };
		methods.forEach(method => {
			members[method] = function(...args) {
				if (Instance !== this) { return new Error('"'+ method +'" called on dead Player'); }
				const self = Private(this);
				if (self[method]) { return Promise.resolve(self[method](...args)); }
				return self.request(method, ...args);
			};
		});
		return members;
	},

	private: (Private, Protected, Public) => ({

		destroy() {
			Instance === this && (Instance = null);
			Protected(this).destroy(new Error('Player was destroyed'));
			this.port && this.port.post('destroy');
			this.removePlayer();
			this.commFrame.remove();
		},

		handleEvent(event) {
			switch (event.type) {
				case 'visibilitychange': {
					if (document.hidden || !this.root) { return; }
					this.root.dataset.visible = true;
					this.main.removeDomListener(document, 'visibilitychange', this, false);
				} break;
			}
		},

		request(name, ...args) {
			if (!this.queue) {
				return this.port.request(name, ...args);
			}
			const cap = new PromiseCapability;
			this.queue.push([ name, args, cap, ]);
			return cap.promise;
		},

		initPlayer(element) {
			const self = Public(this), _this = Protected(this);
			this.root && this.suspendPlayer();
			this.port.post('initPlayer', element.ownerDocument !== document);
			this.root = self.root = element;
			this.video = self.video = element.querySelector('video');
			this.queue && this.queue.forEach(([ method, args, { resolve, reject, } ]) => this.port.request(method, ...args).then(resolve, reject));
			this.queue = null;
			_this.emit('loaded', element);
			RemoveObserver.on(this.root, this.removePlayer);
			if (!element.dataset.visible) {
				if (!(element.dataset.visible = !document.hidden)) {
					this.main.addDomListener(document, 'visibilitychange', this, false);
				}
			}
		},

		removePlayer() {
			if (!this.root) { return; }
			const self = Public(this), _this = Protected(this);
			_this.emit('unloaded', this.root);
			RemoveObserver.off(this.root, this.removePlayer);
			this.main.removeDomListener(document, 'visibilitychange', this, false);
			!this.queue && (this.queue = [ ]);
			this.root = self.root = null;
			this.video = self.video = null;
			this.suspended.length && this.initPlayer(this.suspended.pop());
		},

		suspendPlayer() {
			if (!this.root) { return; }
			const old = this.root;
			const suspended = this.suspended.concat(old);
			RemoveObserver.on(old, () => this.suspended = this.suspended.filter(value => value !== old));
			this.suspended = [ ];
			this.removePlayer();
			this.suspended = suspended;
		},

		loadExternalPlayer({ reason, } = { }) {
			if (reason === 'age' && !this.main.options.player.children.bypassAge.value) { return; }
			this.removePlayer();
			const { videoId, } = this.main;
			document.querySelector('#player-unavailable').classList.add('hid');
			const container = document.querySelector('#player-api');
			container.classList.remove('off-screen-target');
			container.innerHTML = Templates.youtubeIframe(videoId);
			const iframe = container.querySelector('#external_player');

			// call initPlayer
			iframe.onload = (() => {
				const cd = iframe.contentDocument;
				const element = cd.querySelector('.html5-video-player');
				if (element) {
					this.initPlayer(element);
				} else {
					const observer = new MutationObserver(mutations => mutations.forEach(({ addedNodes, }) => Array.prototype.forEach.call(addedNodes, element => {
						if (!element.matches || !element.matches('.html5-video-player')) { return; }
						observer.disconnect();
						this.initPlayer(element);
					})));
					observer.observe(cd, { subtree: true, childList: true, });
				}

				// catch link clicks
				cd.addEventListener('mousedown', ({ target, button, }) => !button && target.matches && target.matches('a *, a') && (location.href = getParent(target, 'a').href));
				// forward mouse wheel events (bug in Firefox?)
				cd.addEventListener('wheel', event => { iframe.dispatchEvent(new WheelEvent('wheel', event)); event.stopPropagation(); event.ctrlKey && event.preventDefault(); });
			});

			// load related videos
			new HttpRequest('https://www.youtube.com/get_video_info?asv=3&hl=en_US&video_id='+ videoId)
			.then(({ responseText, }) => document.getElementById('watch7-sidebar-modules').innerHTML = Templates.relatedVideoList(
				decodeURIComponent(new QueryObject(responseText).rvs).split(',')
				.map(string => Templates.relatedVideoListItem(new QueryObject(string, '&', '=', decodeURIComponent)))
			)).catch(error =>console.error('failed to load related videos', error));
		},

		pause(smooth) {
			const { video, main, } = this;
			if (!video) { return this.request('pause'); }
			if (video.paused) { return; }
			if (!smooth) {
				video.pause();
			} else {
				const pos = video.currentTime;
				this.fadeVolume(1 / fadeIn_factor, () => {
					video.pause();
					video.currentTime = pos;
				});
			}
		},

		play(smooth) {
			if (!this.video) { return this.request('play'); }
			if (this.video.readyState !== 4) {
				if (this.root.dataset.visible !== 'true') {
					this.main.port.emit('focus_temporary');
				} else {
					const timer1 = setTimeout(() => this.main.port.emit('focus_temporary'), 2000);
					// const timer2 = setTimeout(() => createElement('a', { className: 'spf-link', href: location.href, }).click(), 5000);
					Public(this).once('playing', () => clearTimeout(timer1)/* === clearTimeout(timer2)*/);
				}
				return this.request('play');
			}
			if (!this.video.paused) { return; }
			this.video.play();
			smooth && this.fadeVolume(fadeIn_factor);
		},

		fadeVolume(factor, done = x => x) {
			if (!this.fadeProps) {
				const { video, main, } = this;
				const old = video.volume;
				const fadeProps = this.fadeProps = { factor, done, };
				let i = factor > 1 ? fadeIn_margin : 1;
				const iterate = () => {
					i *= fadeProps.factor;
					if (i > 1 || i <= fadeIn_margin) {
						main.port.off('ping', iterate);
						main.port.emit('ping_stop');
						video.volume = old;
						this.fadeProps = null;
						fadeProps.done.call();
					} else {
						video.volume = old * i;
					}
				};
				main.port.emit('ping_start');
				main.port.on('ping', iterate);
				iterate();
			} else {
				this.fadeProps.factor = factor;
				this.fadeProps.done = done;
			}
		},

		togglePlayPause(smooth) {
			return this.video.paused ? this.play(smooth) : this.pause(smooth);
		},
	}),
});

return (Player.Player = Player);

}); })();
