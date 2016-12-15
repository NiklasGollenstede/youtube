(() => { 'use strict'; define([ 'node_modules/es6lib/port', 'require', ], (Port, require) => `(`+ (function(Port) { 'use strict'; // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

console.log('unsafe loading');

let player;

const methods = {
	setQuality      (value) { this.setPlaybackQuality(value);  return waitFor('qualityChanged'); },
	getQuality      ()      { return { available: this.getAvailableQualityLevels(), current: this.getPlaybackQuality(), }; },
	setSpeed        (value) { return this.setPlaybackRate(value); },
	getSpeed        ()      { return { available: this.getAvailablePlaybackRates(), current: this.getPlaybackRate(), }; },
	play            ()      { this.playVideo();                return waitFor('playing'); }, // TODO: if this.getPlayerState() === 5 (stopped) ...
	pause           ()      { this.pauseVideo();               return waitFor('paused'); },
	end             ()      { this.seekTo(Number.MAX_VALUE);   return waitFor('ended'); },
	stop            ()      { this.stopVideo();                return waitFor('unstarted'); },
	start           ()      { this.seekTo(0);                  return waitFor('playing'); },
	next            ()      { this.nextVideo();                return waitFor('videoCued'); },
	previous        ()      { this.previousVideo();            return waitFor('videoCued'); },
	seekTo          (value) { return this.seekTo(value); },
	togglePlayPause ()      { return player[this.getPlayerState() === 1 ? 'pauseVideo' : 'playVideo'](); },
	volume          (value) { return this.setVolume(value); },
	mute            ()      { return this.mute(); },
	unMute          ()      { return this.unMute(); },
	toggleMute      ()      { return player[this.isMuted() ? 'unMute' : 'mute'](); },

	isMuted         ()      { return this.isMuted(); },
	getTime         ()      { return this.getCurrentTime(); },
	getLoaded       ()      { return this.getVideoLoadedFraction(); },
	showVideoInfo   ()      { return this.showVideoInfo(); },
	hideVideoInfo   ()      { return this.hideVideoInfo(); },
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
	console.log('player', player);
	player.addEventListener('onStateChange', 'unsafeOnPlaybackStateChange');
	player.addEventListener('onPlaybackQualityChange', 'unsafeOnPlaybackQualityChange');

	Object.keys(methods).forEach(key => port.removeHandler(key));
	port.addHandlers(methods, player);
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
	player = null;
}

const types = {
	'-1': 'unstarted',
	0: 'ended',
	1: 'playing',
	2: 'paused',
	3: 'buffering',
	5: 'videoCued',
};

const waiting = {
	qualityChanged: [ ],
	unstarted: [ ],
	ended: [ ],
	playing: [ ],
	paused: [ ],
	buffering: [ ],
	videoCued: [ ],
};

function waitFor(type) {
	return new Promise(resolve => waiting[type].push(resolve));
}

function emit(type, value) {
	waiting[type].forEach(func => func(value));
	waiting[type] = [ ];
	port.post('emit', type, value);
}

function unsafeOnPlaybackStateChange(state) {
	emit(types[state], player.getCurrentTime());
}

function unsafeOnPlaybackQualityChange(quality) {
	emit('qualityChanged', quality);
}

}) +`)((${ require.cache['node_modules/es6lib/port'].factory })());//# sourceURL=${ require.toUrl('./player.js.js') }`); })();
