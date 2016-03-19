'use strict'; define('content/player-proxy', [
	'common/event-emitter',
	'es6lib',
], function(
	EventEmitter,
	{
		object: { Class, },
		dom: { createElement, },
	}
) {

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

const PlayerProxy = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function(main) {
		if (Instance) { return Instance; }
		Super.call(this);
		const self = Private(this);
		const _this = Protected(this);
		self.main = main;
		self.promises = { };
		self.queue = [ ];
		this.playerCreated = false;
		this.scriptLoaded = false;
		this.video = null;
		main.once(Symbol.for('destroyed'), () => self.destroy());
		self.create(this, _this);
		Instance = this;
	}),

	public: Private => {
		const members = { };
		methods.forEach(([ method, event, ]) => {
			if (!method) { return; }
			members[method] = function(...args) {
				const self = Private(this);
				let value; if (self[method] && (value = self[method](...args))) { return value; }
				if (self.playerCreated && self.scriptLoaded) {
					sendMessage(method, args);
				} else {
					self.queue.push([ method, args, ]);
				}
				return event && this[event];
			};
		});
		return members;
	},

	private: (Private, Protected, Public) => ({

		create(self, _this) {
			methods.forEach(([ method, event, ]) => event && this.setPromise(event, self));

			this.main.once('playerCreated', () => this.playerCreated = true);

			const initPlayer = () => {
				sendMessage('initPlayer');
				this.video = document.querySelector('.html5-main-video, video');
			};
			const sendQueue = () => this.queue.forEach(([ method, args, ]) => sendMessage(method, args)) === (this.queue = null);

			const loadScript = () => {
				// inject unsafe script
				document.body.appendChild(createElement('script', {
					src: chrome.extension.getURL('content/unsafe.js'),
				})).remove();

				const done = (message) => {
					// wait for script
					if (!isTrusted(message) || message.data.type !== '_scriptLoaded') { return; }
					window.addEventListener('message', this);
					window.removeEventListener('message', done);
					this.scriptLoaded = true;

					// wait for player
					this.main.on('playerCreated', initPlayer);
					if (this.playerCreated) {
						initPlayer();
						sendQueue();
					} else {
						this.main.once('playerCreated', sendQueue);
					}
				};
				window.addEventListener('message', done);
			};

			if (document.readyState === 'interactive' || document.readyState === 'complete') {
				loadScript();
			} else {
				document.addEventListener('DOMContentLoaded', loadScript);
			}
		},

		destroy() {
			const self = Public(this);
			Instance = null;
			const canceled = new Error('Player was destroyed');
			Object.keys(this.promises).forEach(type => this.promises[type].reject(canceled) === self[type].catch(x=>x));
			window.removeEventListener('message', this);
			sendMessage('destroy');
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

		pause(smooth) {
			const { video, main, } = this;
			if (!smooth) { video.pause(); return true; }
			if (video.paused) { return true; }
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
			if (video.readyState !== 4) { return false; }
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
			this.video.paused ? this.play(smooth) : this.pause(smooth);
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

return (PlayerProxy.PlayerProxy = PlayerProxy); });
