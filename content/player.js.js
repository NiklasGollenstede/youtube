(function(global) { 'use strict'; define([ 'node_modules/es6lib/port', 'require', ], (Port, require) => `(function(global) { 'use strict'; (`+ (function(Port) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

const fadeIn_factor = 1.4, fadeIn_margin = 0.05;

let player, video;

const methods = {
	play            : play,
	pause           : pause,
	togglePlayPause : ()    => { return (player.getPlayerState() === 1 ? pause : play)(...arguments); },
	end             : ()    => { player.seekTo(Number.MAX_VALUE);   return waitFor('ended'); },
	stop            : ()    => { player.stopVideo();                return waitFor('unstarted', 'videoCued'); },
	start           : ()    => { player.seekTo(0);                  return waitFor('playing'); },
	next            : ()    => { player.nextVideo();                return waitFor('videoCued'); },
	previous        : ()    => { player.previousVideo();            return waitFor('videoCued'); },
	seekTo          : value => { return player.seekTo(value); },
	volume          : value => { return player.setVolume(value); },
	mute            : ()    => { return player.mute(); },
	unMute          : ()    => { return player.unMute(); },
	toggleMute      : ()    => { return player[player.isMuted() ? 'unMute' : 'mute'](); },
	setQuality      : value => { player.setPlaybackQuality(value);  return waitFor('qualityChanged'); },
	getQuality      : ()    => { return { available: player.getAvailableQualityLevels(), current: player.getPlaybackQuality(), }; },
	setSpeed        : value => { return player.setPlaybackRate(value); },
	getSpeed        : ()    => { return { available: player.getAvailablePlaybackRates(), current: player.getPlaybackRate(), }; },
	isMuted         : ()    => { return player.isMuted(); },
	getTime         : ()    => { return player.getCurrentTime(); },
	getLoaded       : ()    => { return player.getVideoLoadedFraction(); },
	showVideoInfo   : ()    => { return player.showVideoInfo(); },
	hideVideoInfo   : ()    => { return player.hideVideoInfo(); },
};

const { port1, port2, } = new MessageChannel;
document.currentScript.previousSibling.contentWindow.postMessage(null, '*', [ port2, ]);
const port = new Port(port1, Port.MessagePort);

port.addHandlers([ initPlayer, destroy, ]);

function initPlayer(isExternal) {
	try {
		player && player.removeEventListener('onStateChange', 'unsafeOnPlaybackStateChange');
		player && player.removeEventListener('onPlaybackQualityChange', 'unsafeOnPlaybackQualityChange');
	} catch (error) { console.error(error); }

	const cw = isExternal ? document.querySelector('#external_player').contentWindow : window;
	cw.unsafeOnPlaybackStateChange = unsafeOnPlaybackStateChange;
	cw.unsafeOnPlaybackQualityChange = unsafeOnPlaybackQualityChange;

	player = cw.document.querySelector('.html5-video-player');
	video = player.querySelector('video');
	console.log('player', player);
	player.addEventListener('onStateChange', 'unsafeOnPlaybackStateChange');
	player.addEventListener('onPlaybackQualityChange', 'unsafeOnPlaybackQualityChange');

	Object.keys(methods).forEach(key => port.removeHandler(key));
	port.addHandlers(methods);
}

function destroy() {
	console.log('destroy unsave.js');
	try {
		player && player.removeEventListener('onStateChange', 'unsafeOnPlaybackStateChange');
		player && player.removeEventListener('onPlaybackQualityChange', 'unsafeOnPlaybackQualityChange');
	} catch (error) { console.error(error); }
	delete window.unsafeOnPlaybackStateChange;
	delete window.unsafeOnPlaybackQualityChange;
	port.destroy();
	player = video = null;
}

const typeMap = new Map([
	[ -1, 'unstarted', ], [ 'unstarted', -1, ],
	[  0, 'ended',     ], [ 'ended',      0, ],
	[  1, 'playing',   ], [ 'playing',    1, ],
	[  2, 'paused',    ], [ 'paused',     2, ],
	[  3, 'buffering', ], [ 'buffering',  3, ],
	[  5, 'videoCued', ], [ 'videoCued',  5, ],
]);

const waiting = {
	qualityChanged: [ ],
	unstarted: [ ],
	ended: [ ],
	playing: [ ],
	paused: [ ],
	buffering: [ ],
	videoCued: [ ],
};

function waitFor(...types) {
	if (types.map(_=>typeMap.get(_)).includes(player.getPlayerState())) { return Promise.resolve(player.getCurrentTime()); }
	return Promise.race(types.map(type => new Promise(resolve => waiting[type].push(resolve))));
}

function emit(type, value) {
	waiting[type].forEach(func => func(value));
	waiting[type] = [ ];
	port.post('emit', type, value);
}

function unsafeOnPlaybackStateChange(state) { // this is sometimes called synchronously
	emit(typeMap.get(state), player.getCurrentTime());
}

function unsafeOnPlaybackQualityChange(quality) {
	emit('qualityChanged', quality);
}

function pause(smooth) {
	if (video.paused) { return player.getCurrentTime(); }
	if (!smooth) {
		player.pauseVideo();
	} else {
		const pos = video.currentTime;
		fadeVolume(1 / fadeIn_factor, () => {
			player.pauseVideo();
			video.currentTime = pos;
		});
	}
	return waitFor('paused');
}

function play(smooth, recursing) {

	if (!recursing && player.dataset.visible !== 'true') { // YouTube won't start playing if the tab was never visible
		return port.request('tab.focus_temporary').then(() => play.call(player, smooth, true));
	}

	if (video.readyState === 4) { // video is ready to play
		if (!video.paused) { console.log('playing anyway'); return player.getCurrentTime(); }
		video.play();
		smooth && fadeVolume(fadeIn_factor);
		return waitFor('playing');
	}

	if (player.getPlayerState() === 5) { // the player is stopped, just calling play will likely get it stuck buffering at ~4s
		console.log('reloading video');
		player.loadVideoById(new URL(player.getVideoUrl()).searchParams.get('v')); // reload the current video
		return waitFor('playing');
	}

	// the video is most likely genuinely buffering and will play
	player.playVideo();

	//	const timer1 = setTimeout(() => this.main.port.emit('focus_temporary'), 2000);
	//	waitFor('playing').then(() => clearTimeout(timer1));

	return waitFor('playing');
}

let fadeProps = null;

function fadeVolume(factor, done = _=>_) {
	if (!fadeProps) {
		const old = video.volume;
		fadeProps = { factor, done, };
		let i = factor > 1 ? fadeIn_margin : 1;
		(function iterate() {
			i *= fadeProps.factor;
			if (i > 1 || i <= fadeIn_margin) {
				fadeProps.done.call();
				video.volume = old;
				fadeProps = null;
			} else {
				video.volume = old * i;
				port.request('tab.reply_after', 25).then(iterate); // setTimeout won't do because chrome throttles that to 1s for background tabs
			}
		})();
	} else {
		fadeProps.factor = factor;
		fadeProps.done = done;
	}
}

}) +`)((${ require.cache['node_modules/es6lib/port'].factory })()); })((function() { /* jshint strict: false */ return this; })()); //# sourceURL=${ require.toUrl('./player-injected.js') }`); })(this);
