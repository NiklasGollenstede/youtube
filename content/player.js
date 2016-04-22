'use strict'; define('content/player', [
	'common/event-emitter', 'content/templates', 'es6lib',
], function(
	EventEmitter,
	Templates,
	{
		format: { QueryObject, },
		functional: { log, },
		dom: { createElement, DOMContentLoaded, RemoveObserver, },
		object: { Class, },
		network: { HttpRequest, },
	}
) { /* global WheelEvent */

const fadeIn_factor = 0.7, fadeIn_margin = 0.05;

let Instance = null;

const target = {
	other: 'unsafe-player-proxy',
	self: 'content-player-proxy',
};

const methods = [
	[ 'setQuality',         'qualityChanged',   ],
	[ 'getQuality',         '_getQuality',      ],
	[ 'setSpeed',           null,               ],
	[ 'getSpeed',           '_getSpeed',        ],
	[ 'play',               'playing',          ],
	[ 'pause',              'paused',           ],
	[ 'end',                'ended',            ],
	[ 'stop',               'unstarted',        ],
	[ 'start',              'playing',          ],
	[ 'next',               'videoCued',        ],
	[ 'previous',           'videoCued',        ],
	[ 'seekTo',             null,               ],
	[ 'togglePlayPause',    null,               ],
	[ 'volume',             null,               ],
	[ 'mute',               null,               ],
	[ 'unMute',             null,               ],
	[ 'toggleMute',         null,               ],

	[ 'isMuted',            '_isMuted',         ],
	[ 'getTime',            '_getTime',         ],
	[ 'showVideoInfo',      null,               ],
	[ 'hideVideoInfo',      null,               ],

	[ 'silence',            null,               ],
	[ null,                 'buffering',        ],
];

function isTrusted({ data, origin, isTrusted, }) {
	return isTrusted && origin === 'https://www.youtube.com' && typeof data === 'object' && data.target === target.self;
}
function sendMessage(type, args = [ ]) {
	return window.postMessage({ target: target.other, type, args, }, '*');
}

const Player = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function(main) {
		if (Instance) { return Instance; }
		Super.call(this);
		const self = Private(this), _this = Protected(this);
		self.main = main;
		self.promises = { };
		self.queue = [ ];
		this.video = self.video = this.root = self.root = null;
		self.removePlayer = self.removePlayer.bind(self);
		self.visibilityChange = self.visibilityChange.bind(self);
		main.once(Symbol.for('destroyed'), () => self.destroy());
		methods.forEach(([ method, event, ]) => event && self.setPromise(event, this));
		self.create(this, _this);
		Instance = this;
	}),

	public: Private => {
		const members = { };
		methods.forEach(([ method, event, ]) => {
			if (!method) { return; }
			members[method] = function(...args) {
				if (Instance !== this) { return new Error('"'+ method +'" called on dead Player'); }
				const self = Private(this);
				let value; if (self[method] && (value = self[method](...args))) { return value; }
				if (self.queue) {
					self.queue.push([ method, args, ]);
				} else {
					sendMessage(method, args);
				}
				return event && this[event];
			};
		});
		return members;
	},

	private: (Private, Protected, Public) => ({

		create(self, _this) {
			this.main.once('observerCreated', () => {
				// inject unsafe script
				document.body.appendChild(createElement('script', {
					src: chrome.extension.getURL('web/player.js'),
				})).remove();

				const done = (message) => {
					// wait for script
					if (!isTrusted(message) || message.data.type !== '_scriptLoaded') { return; }
					window.removeEventListener('message', done);

					// wait for player
					this.main.observer.all('#movie_player', this.initPlayer.bind(this));
					this.main.observer.all('#watch7-player-age-gate-content', this.loadExternalPlayer.bind(this, { reason: 'age', }));
				};
				window.addEventListener('message', done);
			});
		},

		destroy() {
			const self = Public(this);
			Instance = null;
			const canceled = new Error('Player was destroyed');
			Object.keys(this.promises).forEach(type => { this.promises[type].reject(canceled); self[type].catch(x=>x); });
			sendMessage('destroy');
			this.removePlayer();
			Protected(this).destroy();
		},

		handleEvent(message) {
			if (!isTrusted(message)) { return; }
			const { type, arg, } = message.data;
			if (!this.promises.hasOwnProperty(type)) { throw new Error('Unknown event type: "'+ type +'"'); }

			console.log('player event', type, arg);

			this.promises[type].resolve(arg);
			this.setPromise(type);
			!(/^_/).test(type) && Protected(this).emit(type, arg);
		},

		setPromise(type, self = Public(this)) {
			return (self[type] = new Promise((resolve, reject) => {
				this.promises[type] = { resolve, reject, };
			}));
		},

		visibilityChange(event) {
			if (document.hidden || !this.root) { return; }
			this.root.dataset.visible = true;
			this.main.removeDomListener(document, 'visibilitychange', this.visibilityChange, false);
		},

		initPlayer(element) {
			const self = Public(this), _this = Protected(this);
			sendMessage('initPlayer', [ element.ownerDocument !== document, ]);
			window.addEventListener('message', this);
			this.root = self.root = element;
			this.video = self.video = element.querySelector('video');
			this.queue && this.queue.forEach(([ method, args, ]) => sendMessage(method, args));
			this.queue = null;
			_this.emit('playerElementAdded', element);
			RemoveObserver.on(this.root, this.removePlayer);
			if (!element.dataset.visible) {
				if (!(element.dataset.visible = !document.hidden)) {
					this.main.addDomListener(document, 'visibilitychange', this.visibilityChange, false);
				}
			}
		},

		removePlayer() {
			if (!this.root) { return; }
			window.removeEventListener('message', this);
			RemoveObserver.off(this.root, this.removePlayer);
			this.root = this.video = null;
			!this.queue && (this.queue = [ ]);
		},

		loadExternalPlayer({ reason, } = { }) {
			if (reason === 'age' && !this.main.options.player.bypassAge) { return; }
			this.removePlayer();
			const { videoId, } = this.main;
			document.querySelector('#player-unavailable').classList.add("hid");
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
				// cd.addEventListener('wheel', event => iframe.dispatchEvent(new WheelEvent('wheel', event)));
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
			if (!video) { return false; }
			if (video.paused) { return true; }
			if (!smooth) { video.pause(); return true; }
			const old = video.volume, pos = video.currentTime;
			let i = 1;
			main.port.emit('ping_start');
			main.port.on('ping', iterate);
			iterate();
			return true;

			function iterate() {
				i *= fadeIn_factor;
				if (i <= fadeIn_margin) {
					video.pause();
					video.volume = old;
					video.currentTime = pos;
					main.port.off('ping', iterate);
					main.port.emit('ping_stop');
				} else {
					video.volume = old * i;
				}
			}
		},

		play(smooth) {
			const { video, main, } = this;
			if (!video) { return false; }
			if (video.readyState !== 4) {
				if (video.dataset.visible != 'true') {
					this.main.port.emit('focus_temporary');
				}
				return false;
			}
			if (!video.paused) { return true; }
			if (!smooth) { video.play(); return true; }
			const old = video.volume;
			let i = fadeIn_margin;
			main.port.emit('ping_start');
			main.port.on('ping', iterate);
			video.play();
			iterate();
			return true;

			function iterate() {
				i /= fadeIn_factor;
				if (i > 1) {
					video.volume = old;
					main.port.off('ping', iterate);
					main.port.emit('ping_stop');
				} else {
					video.volume = old * i;
				}
			}
		},

		togglePlayPause(smooth) {
			return this.video.paused ? this.play(smooth) : this.pause(smooth);
		},

		silence() {
			const video = this.video;
			if (!video) { return () => void 0; }
			const old = video.volume;
			video.volume = 0;
			return () => video.volume = old;
		},
	}),
});

function getParent(element, selector) {
	while (element && (!element.matches || !element.matches(selector))) { element = element.parentNode; }
	return element;
}

return (Player.Player = Player); });
