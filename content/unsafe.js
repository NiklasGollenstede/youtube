'use strict'; (function() {

console.log('unsafe loading');

const target = {
	other: 'content-player-proxy',
	self: 'unsafe-player-proxy',
};

const methods = [
	[ 'setQuality',         'qualityChanged',  (player, args) => player.setPlaybackQuality(...args), ],
	[ 'getQuality',         '_getQuality',     (player, args) => sendMessage('_getQuality', { available: player.getAvailableQualityLevels(), current: player.getPlaybackQuality(), }), ],
	[ 'setSpeed',           null,              (player, args) => player.setPlaybackRate(...args), ],
	[ 'getSpeed',           '_getSpeed',       (player, args) => sendMessage('_getSpeed', { available: player.getAvailablePlaybackRates(), current: player.getPlaybackRate(), }), ],
	[ 'play',               'playing',         (player, args) => player.playVideo(...args), ],
	[ 'pause',              'paused',          (player, args) => player.pauseVideo(...args), ],
	[ 'end',                'ended',           (player, args) => player.seekTo(Number.MAX_VALUE), ],
	[ 'stop',               'unstarted',       (player, args) => player.stopVideo(), ],
	[ 'start',              'playing',         (player, args) => player.seekTo(0), ],
	[ null,                 'buffering',       null, ],
	[ 'next',               'videoCued',       (player, args) => player.nextVideo(...args), ],
	[ 'previous',           'videoCued',       (player, args) => player.previousVideo(...args), ],
	[ 'seekTo',             null,              (player, args) => player.seekTo(...args), ],
	[ 'togglePlayPause',    null,              (player, args) => player[player.getPlayerState() == '1' ? 'pauseVideo' : 'playVideo'](), ],
	[ 'volume',             null,              (player, args) => player.setVolume(...args), ],
	[ 'mute',               null,              (player, args) => player.mute(...args), ],
	[ 'unMute',             null,              (player, args) => player.unMute(...args), ],
	[ 'toggleMute',         null,              (player, args) => player[player.isMuted() ? 'unMute' : 'mute'](...args), ],

	[ 'isMuted',            '_isMuted',        (player, args) => sendMessage('_isMuted', player.isMuted()), ],
	[ 'getTime',            '_getTime',        (player, args) => sendMessage('_getTime', player.getCurrentTime()), ],
	[ 'showVideoInfo',      null,              (player, args) => player.showVideoInfo(...args), ],
	[ 'hideVideoInfo',      null,              (player, args) => player.hideVideoInfo(...args), ],
];

function isTrusted({ data, origin, isTrusted, }) {
	return isTrusted && origin === 'https://www.youtube.com' && typeof data === 'object' && data.target === target.self;
}
function sendMessage(type, arg) {
	return window.postMessage({ target: target.other, type, arg, }, '*');
}

let player;

window.addEventListener('message', message => {
	if (!isTrusted(message)) { return; }
	const { type, args, } = message.data;
	if (type === 'initPlayer') { return initPlayer(); }

	const method = type && methods.find(pair => pair[0] === type);
	if (!method) { throw new Error('Unknown event type: "'+ type +'"'); }
	console.log('unsafe.js', ...method, ...args);

	method[2](player, args);
});

function initPlayer() {
	player = document.querySelector('.html5-video-player');
	console.log('player', player);
	player.addEventListener('onStateChange', 'unsafeOnPlaybackStateChange');
	player.addEventListener('onPlaybackQualityChange', 'unsafeOnPlaybackQualityChange');
}

window.unsafeOnPlaybackStateChange = function(state) {
	const type = {
		'-1': 'unstarted',
		0: 'ended',
		1: 'playing',
		2: 'paused',
		3: 'buffering',
		5: 'videoCued',
	}[state];

	sendMessage(type, player.getVideoData().video_id);
};

window.unsafeOnPlaybackQualityChange = function(quality) {
	sendMessage('qualityChanged', quality);
};

sendMessage('_scriptLoaded');

})();
