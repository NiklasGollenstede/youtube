'use strict'; define('content/player-proxy', [
	'common/event-emitter',
	'es6lib',
], function(
	EventEmitter,
	{
		object: { Class, },
	}
) {

const fadeIn_factor = 0.9, fadeIn_margin = 0.05;

const target = {
	other: 'unsafe-player-proxy',
	self: 'content-player-proxy',
};

const methods = [
	[ 'setQuality',         'qualityChanged',   ],
	[ 'getQuality',         '_getQuality',      ],
	[ 'setSpeed',           null,               ],
	[ 'getSpeed',           '_getSpeed',        ],
	[ 'play',               'playing',          play, ],
	[ 'pause',              'paused',           pause, ],
	[ 'end',                'ended',            ],
	[ 'stop',               'unstarted',        ],
	[ 'start',              'playing',          ],
	[ null,                 'buffering',        ],
	[ 'next',               'videoCued',        ],
	[ 'previous',           'videoCued',        ],
	[ 'seekTo',             null,               ],
	[ 'togglePlayPause',    null,               (smooth) => (video.paused ? play : pause)(smooth) ],
	[ 'volume',             null,               ],
	[ 'mute',               null,               ],
	[ 'unMute',             null,               ],
	[ 'toggleMute',         null,               ],

	[ 'isMuted',            '_isMuted',         ],
	[ 'getTime',            '_getTime',         ],
	[ 'showVideoInfo',      null,               ],
	[ 'hideVideoInfo',      null,               ],
];

function isTrusted({ data, origin, isTrusted, }) {
	return isTrusted && origin === 'https://www.youtube.com' && typeof data === 'object' && data.target === target.self;
}
function sendMessage(type, args = [ ]) {
	return window.postMessage({ target: target.other, type, args, }, '*');
}

let self, playerCreated, scriptLoaded, queue = [ ], emit, video;

const PlayerProxy = new Class({
	extends: { public: EventEmitter, },
	constructor: (Super, Private, Protected) => (function(main) {
		if (self) { return self; }
		Super.call(this);
		const _self = Protected(this);
		emit = _self.emit.bind(_self);
		self = this;
		createInstance(main);
	}),
});

methods.forEach(([ method, event, local, ]) => {
	if (!method) { return; }
	PlayerProxy.prototype[method] = function(...args) {
		let val; if (local && (val = local(...args))) { return val; }
		if (playerCreated && scriptLoaded) {
			sendMessage(method, args);
		} else {
			queue.push([ method, args, ]);
		}
		return event && this[event];
	};
});

const promises = { };
function setPromise(type) {
	return (self[type] = new Promise((resolve, reject) => {
		promises[type] = { resolve, reject, };
	}));
}

function createInstance(main) {
	methods.forEach(([ method, event, ]) => event && setPromise(event));

	main.once('playerCreated', () => playerCreated = true);

	const initPlayer = () => {
		sendMessage('initPlayer');
		video = document.querySelector('.html5-main-video, video');
	};
	const sendQueue = () => queue.forEach(([ method, args, ]) => sendMessage(method, args)) === (queue = null);

	document.addEventListener('DOMContentLoaded', () => {
		// inject unsafe script
		const script = document.createElement('script');
		script.src = chrome.extension.getURL('content/unsafe.js');
		document.body.appendChild(script).remove();

		const done = (message) => {
			// wait for script
			if (!isTrusted(message) || message.data.type !== '_scriptLoaded') { return; }
			window.addEventListener('message', handleEvent);
			window.removeEventListener('message', done);
			scriptLoaded = true;

			// wait for player
			main.on('playerCreated', initPlayer);
			if (playerCreated) {
				initPlayer();
				sendQueue();
			} else {
				main.once('playerCreated', sendQueue);
			}
		};
		window.addEventListener('message', done);
	});

	function handleEvent(message) {
		if (!isTrusted(message)) { return; }
		const { type, arg, } = message.data;
		if (!promises.hasOwnProperty(type)) { throw new Error('Unknown event type: "'+ type +'"'); }

		console.log('player event', type, arg);

		promises[type].resolve(arg);
		setPromise(type);
		!(/^_/).test(type) && emit(type, arg);
	}
}

function pause(smooth) {
	if (!smooth) { video.pause(); return true; }
	if (video.paused) { return true; }
	const old = video.volume, pos = video.currentTime;
	let i = 1;
	let cancel = setInterval(() => {
		video.volume = old * (i *= fadeIn_factor);
		if (i <= fadeIn_margin) {
			clearTimeout(cancel);
			video.pause();
			video.volume = old;
			video.currentTime = pos;
		}
	}, 10);
	return true;
}

function play(smooth) {
	if (video.readyState !== 4) { return false; }
	if (!video.paused) { return true; }
	if (!smooth) { video.play(); return true; }
	video.play();
	const old = video.volume;
	let i = fadeIn_margin;
	let cancel = setInterval(() => {
		video.volume = old * (i /= fadeIn_factor);
		if (i > 1) {
			clearTimeout(cancel);
			video.volume = old;
		}
	}, 10);
	return true;
}

return (PlayerProxy.PlayerProxy = PlayerProxy); });
