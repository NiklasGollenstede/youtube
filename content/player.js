(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/chrome/': { extension, applications: { gecko, }, },
	'node_modules/es6lib/concurrent': { async, spawn, sleep, },
	'node_modules/es6lib/dom':  { createElement, DOMContentLoaded, RemoveObserver, getParent, },
	'node_modules/es6lib/object': { Class, },
	'node_modules/es6lib/network': { HttpRequest, },
	'node_modules/es6lib/string': { QueryObject, },
	'common/event-emitter': EventEmitter,
	Templates,
	'./player.js': playerJS,
}) { /* globals WheelEvent */

const fadeIn_factor = 1.4, fadeIn_margin = 0.05;

let Instance = null;

const target = {
	other: 'unsafe-player-proxy',
	self: 'content-player-proxy',
};

// table of public members, which all (may) trigger an remote call, and the events they wait for to fulfill their returned promises
// if a private method of the same name exists, that will be called first
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
	[ 'getLoaded',          '_getLoaded',       ],
	[ 'showVideoInfo',      null,               ],
	[ 'hideVideoInfo',      null,               ],

	[ null,                 'buffering',        ],

	[ null,                 'loaded',           ],
	[ null,                 'unloaded',         ],
];

function isTrusted({ data, origin, isTrusted, }) {
	return (gecko || isTrusted) && (/^https:\/\/\w+\.youtube\.com$/).test(origin) && typeof data === 'object' && data.target === target.self;
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
		self.promises = { }; // one pending Promise of each event in the 'methods' array above, to make sure all pending calls are resolved when an event occurs
		self.queue = [ ]; // queue of calls meant for the player while it is not loaded yet
		self.suspended = [ ]; // stack of players that already existed when a new one showed up
		this.video = self.video = null; // the current <video> element
		this.root = self.root = null; // the current root element of the html5-video-player
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
				let value; if (self[method] && (value = self[method](...args))) { return value; } // call private method first. Only proceed if it returns falsy
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
					textContent: playerJS,
				})).remove();

				this.main.observer.all('.html5-video-player', this.initPlayer.bind(this));
				this.main.observer.all('#watch7-player-age-gate-content', this.loadExternalPlayer.bind(this, { reason: 'age', }));
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
			this.root && this.suspendPlayer();
			sendMessage('initPlayer', [ element.ownerDocument !== document, ]);
			window.addEventListener('message', this);
			this.root = self.root = element;
			this.video = self.video = element.querySelector('video');
			this.queue && this.queue.forEach(([ method, args, ]) => sendMessage(method, args));
			this.queue = null;
			_this.emit('loaded', element);
			this.promises.loaded.resolve(element);
			this.setPromise('unloaded', self);
			RemoveObserver.on(this.root, this.removePlayer);
			if (!element.dataset.visible) {
				if (!(element.dataset.visible = !document.hidden)) {
					this.main.addDomListener(document, 'visibilitychange', this.visibilityChange, false);
				}
			}
		},

		removePlayer() {
			if (!this.root) { return; }
			const self = Public(this), _this = Protected(this);
			window.removeEventListener('message', this);
			_this.emit('unloaded', this.root);
			this.promises.unloaded.resolve(this.root);
			this.setPromise('loaded', self);
			RemoveObserver.off(this.root, this.removePlayer);
			this.main.removeDomListener(document, 'visibilitychange', this.visibilityChange, false);
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
			if (!video) { return false; }
			if (video.paused) { return true; }
			if (!smooth) {
				video.pause();
			} else {
				const pos = video.currentTime;
				this.fadeVolume(1 / fadeIn_factor, () => {
					video.pause();
					video.currentTime = pos;
				});
			}
			return true;
		},

		play(smooth) {
			const { video, main, } = this;
			if (!video) { return false; }
			if (video.readyState !== 4) {
				if (video.dataset.visible !== 'true') {
					this.main.port.emit('focus_temporary');
				} else {
					const timer1 = setTimeout(() => this.main.port.emit('focus_temporary'), 2000);
					const timer2 = setTimeout(() => createElement('a', { className: 'spf-link', href: location.href, }).click(), 5000);
					Public(this).once('playing', () => clearTimeout(timer1) === clearTimeout(timer2));
				}
				return false;
			}
			if (!video.paused) { return true; }
			video.play();
			smooth && this.fadeVolume(fadeIn_factor);
			return true;
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
