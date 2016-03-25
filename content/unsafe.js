'use strict'; (function() {

console.log('unsafe loading');

const target = {
	other: 'content-player-proxy',
	self: 'unsafe-player-proxy',
};

const methods = {
	   setQuality:      (player, args) => player.setPlaybackQuality(...args),
	   getQuality:      (player, args) => sendMessage('_getQuality', { available: player.getAvailableQualityLevels(), current: player.getPlaybackQuality(), }),
	   setSpeed:        (player, args) => player.setPlaybackRate(...args),
	   getSpeed:        (player, args) => sendMessage('_getSpeed', { available: player.getAvailablePlaybackRates(), current: player.getPlaybackRate(), }),
	   play:            (player, args) => player.playVideo(...args),
	   pause:           (player, args) => player.pauseVideo(...args),
	   end:             (player, args) => player.seekTo(Number.MAX_VALUE),
	   stop:            (player, args) => player.stopVideo(),
	   start:           (player, args) => player.seekTo(0),
	   next:            (player, args) => player.nextVideo(...args),
	   previous:        (player, args) => player.previousVideo(...args),
	   seekTo:          (player, args) => player.seekTo(...args),
	   togglePlayPause: (player, args) => player[player.getPlayerState() == '1' ? 'pauseVideo' : 'playVideo'](),
	   volume:          (player, args) => player.setVolume(...args),
	   mute:            (player, args) => player.mute(...args),
	   unMute:          (player, args) => player.unMute(...args),
	   toggleMute:      (player, args) => player[player.isMuted() ? 'unMute' : 'mute'](...args),

	   isMuted:         (player, args) => sendMessage('_isMuted', player.isMuted()),
	   getTime:         (player, args) => sendMessage('_getTime', player.getCurrentTime()),
	   showVideoInfo:   (player, args) => player.showVideoInfo(...args),
	   hideVideoInfo:   (player, args) => player.hideVideoInfo(...args),
};

function isTrusted({ data, origin, isTrusted, }) {
	return isTrusted && origin === 'https://www.youtube.com' && typeof data === 'object' && data.target === target.self;
}
function sendMessage(type, arg) {
	return window.postMessage({ target: target.other, type, arg, }, '*');
}

let player;

function onMessage(message) {
	if (!isTrusted(message)) { return; }
	const { type, args, } = message.data;
	if (type === 'initPlayer') { return initPlayer(); }
	if (type === 'destroy') { return destroy(); }

	const method = type && methods[type];
	if (!method) { throw new Error('Unknown event type: "'+ type +'"'); }
	console.log('unsafe.js', type, ...args);

	method(player, args);
}

function initPlayer() {
	try {
		player && player.removeEventListener('onStateChange', 'unsafeOnPlaybackStateChange');
		player && player.removeEventListener('onPlaybackQualityChange', 'unsafeOnPlaybackQualityChange');
	} catch (error) { console.error(error); }
	player = document.querySelector('.html5-video-player');
	console.log('player', player);
	player.addEventListener('onStateChange', 'unsafeOnPlaybackStateChange');
	player.addEventListener('onPlaybackQualityChange', 'unsafeOnPlaybackQualityChange');
}

function destroy() {
	console.log('destroy unsave.js');
	window.removeEventListener('message', onMessage);
	window.unsafeOnPlaybackStateChange = null;
	window.unsafeOnPlaybackQualityChange = null;
	player.removeEventListener('onStateChange', 'unsafeOnPlaybackStateChange');
	player.removeEventListener('onPlaybackQualityChange', 'unsafeOnPlaybackQualityChange');
	player = null;
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

	sendMessage(type);
};

window.unsafeOnPlaybackQualityChange = function(quality) {
	sendMessage('qualityChanged', quality);
};

window.addEventListener('message', onMessage);

sendMessage('_scriptLoaded');

})();
