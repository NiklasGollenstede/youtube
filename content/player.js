(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/concurrent': { Resolvable, PromiseCapability, },
	'node_modules/es6lib/dom':  { createElement, RemoveObserver, getParent, },
	'node_modules/es6lib/network': { HttpRequest, },
	'node_modules/es6lib/object': { Class, },
	'node_modules/es6lib/port': Port,
	'node_modules/es6lib/string': { QueryObject, },
	'common/event-emitter': EventEmitter,
	Templates,
	'./player.js': playerJS,
}) => { /* globals WheelEvent */

let Instance = null;

// table of public members, which all remotely call methods in ./player.js.js
const methods = [
	'play',
	'pause',
	'togglePlayPause',
	'end',
	'stop',
	'start',
	'next',
	'previous',
	'seekTo',
	'volume',
	'mute',
	'unMute',
	'toggleMute',
	'setQuality',
	'getQuality',
	'setSpeed',
	'getSpeed',
	'isMuted',
	'getTime',
	'getLoaded',
	'showVideoInfo',
	'hideVideoInfo',
];

const Player = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function Player(main) {
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
			self.port = new Port(event.ports[0], Port.MessagePort)
			.addHandler('emit', _this.emitSync, _this)
			.addHandler((/^tab\./), (name, ...args) => { console.log('forwarding', name); return main.port[self.port.isRequest() ? 'request' : 'post'](name, ...args); });
			main.port.addHandler((/^player\./), (name, ...args) => { console.log('forwarding', name); self.port[main.port.isRequest() ? 'request' : 'post'](name.slice('player.'.length), ...args); });
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
				// return Private(this).request(method, ...args)
				const self = Private(this);
				console.log('player request', method, ...args);
				return self.request(method, ...args).then(value => { console.log('player resolve', method, value); return value; });
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
			this.queue && this.queue.forEach(([ method, args, { resolve, reject, }, ]) => this.port.request(method, ...args).then(resolve, reject));
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
			RemoveObserver.on(old, () => (this.suspended = this.suspended.filter(value => value !== old)));
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
			.then(({ responseText, }) => (document.getElementById('watch7-sidebar-modules').innerHTML = Templates.relatedVideoList(
				decodeURIComponent(new QueryObject(responseText).rvs).split(',')
				.map(string => Templates.relatedVideoListItem(new QueryObject(string, '&', '=', decodeURIComponent)))
			))).catch(error =>console.error('failed to load related videos', error));
		},

	}),
});

return (Player.Player = Player);

}); })(this);
