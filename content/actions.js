(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { createElement, saveAs, },
	'node_modules/es6lib/string': { hhMmSsToSeconds, secondsToHhMmSs, QueryObject, },
	options,
	player,
	dom,
}) => {
/* global window, document, location, prompt, */

const keyMap = new Map;

const actions = {
	async videoIncreaseQuality() {
		const { available, current, } = (await player.getQuality());
		const quality = available[available.indexOf(current) - 1];
		quality && player.setQuality(quality);
	},
	async videoDecreaseQuality() {
		const { available, current, } = (await player.getQuality());
		const quality = available[available.indexOf(current) + 1];
		quality && player.setQuality(quality);
	},
	async videoIncreaseSpeed() {
		const { available, current, } = (await player.getSpeed());
		const speed = available[available.indexOf(current) + 1];
		speed && player.setSpeed(speed);
	},
	async videoDecreaseSpeed() {
		const { available, current, } = (await player.getSpeed());
		const speed = available[available.indexOf(current) - 1];
		speed && player.setSpeed(speed);
	},
	videoToggleFullscreen() {
		document.querySelector('.ytp-fullscreen-button').click();
	},
	videoPromptPosiotion() {
		const seconds = hhMmSsToSeconds(prompt('Seek to (hh:mm:SS.ss): '));
		seconds >= 0 && player.seekTo(seconds);
	},
	videoPromptVolume() {
		player.volume(Math.min(Math.max(0, parseInt(prompt('Volume in %: '))), 100) || 0);
	},
	playlistNext() {
		player.next();
	},
	playlistPrevious() {
		player.previous();
	},
	playlistToggleShuffle() {
		document.querySelector('.shuffle-playlist').click();
	},
	playlistToggleLoop() {
		document.querySelector('.toggle-loop').click();
	},
	playlistClear() {
		const queryObject = new QueryObject(window.location.search);
		if (!queryObject.list) { return; }
		delete queryObject.list;
		delete queryObject.index;
		queryObject.t = Math.floor(player.getTime());
		window.location = window.location.href.split('?')[0] +'?'+ queryObject.toString();
	},
	videoTogglePause() {
		player.togglePlayPause(true);
	},
	videoPlay() {
		player.play(true);
	},
	videoPause() {
		player.pause(true);
	},
	videoStop() {
		player.stop();
	},
	videoStart() {
		player.start(true);
	},
	videoEnd() {
		player.end();
	},
	videoToggleMute() {
		player.toggleMute();
	},
	videoToggleInfoScreen() {
		const element = document.querySelector('.html5-video-info-panel');
		if (!element || element.style.display === 'none') {
			player.showVideoInfo();
		} else {
			player.hideVideoInfo();
		}
	},
	videoPushScreenshot() {
		const { video, } = player;
		if (!video || !video.videoWidth || !video.videoHeight) { return; }
		let canvas; const time = video.currentTime;
		const ref = document.querySelector('#watch-discussion, ytg-related-videos');
		ref.parentNode.insertBefore(createElement('div', {
			className: 'yt-card yt-card-has-padding screenshot-preview',
			style: { position: 'relative', },
		}, [
			canvas = createElement('canvas', {
				width: video.videoWidth,
				height: video.videoHeight,
				style: { maxWidth: '100%', },
				ondblclick() {
					if (canvas.requestFullscreen) {
						document.fullscreenElement ? document.exitFullscreen() : canvas.requestFullscreen();
					} else if (canvas.webkitRequestFullscreen) {
						document.webkitFullscreenElement ? document.webkitExitFullscreen() : canvas.webkitRequestFullscreen();
					} else if (canvas.mozRequestFullScreen) {
						document.mozFullScreenElement ? document.mozCancelFullScreen() : canvas.mozRequestFullScreen();
					}
				},
			}),
			createElement('span', {
				className: 'video-time yt-uix-tooltip',
				style: {
					position: 'absolute',
					right: '12px',
					bottom: '12px',
					cursor: 'pointer',
				},
				textContent: secondsToHhMmSs(time << 0),
				title: time.toFixed(2) +'s',
				onclick: event => player.seekTo(time),
			}),
			createElement('button', {
				className: 'yt-uix-button yt-uix-button-size-default yt-uix-button-default',
				style: {
					position: 'absolute',
					right: '12px',
					top: '12px',
					lineHeight: '20px',
				},
				textContent: '⨉',
				onclick: event => event.target.parentNode.remove(),
			}),
		]), ref);
		canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
	},
	videoPopScreenshot() {
		document.querySelector('.screenshot-preview').remove();
	},
	videoSave() { // TODO: remove
		return actions.videoDownloadCover();
	},
	async videoDownloadCover() {
		const url = `https://i.ytimg.com/vi/${ new QueryObject(location.search).v }/maxresdefault.jpg`;
		const title = (document.querySelector('#eow-title') || { textContent: 'cover', }).textContent.trim();
		const image = (await global.fetch(url).then(_=>_.blob()).catch(() => url));
		saveAs(image, title +'.jpg');
	},
	openRelatedModifier({ key, }) {
		document.querySelectorAll('li.video-list-item.related-list-item')[key - 1].querySelector('a').click();
	},
};

function setAction(name, action) {
	return (actions[name] = action);
}

function onKey(event) {
	if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') { return; }
	const key = (event.ctrlKey ? 'Ctrl+' : '') + (event.altKey ? 'Alt+' : '') + (event.shiftKey ? 'Shift+' : '') + event.code;
	const name = keyMap.get(key);
	if (!name || !actions[name]) { return; }
	console.log('keypress', key, name);
	event.stopPropagation(); event.preventDefault();
	actions[name](event);
}

options.keys.children.forEach(command => command.whenChange((now, old) => {
	if (command.name === 'openRelatedModifier') {
		now = [1,2,3,4,5,6,7,8,9,0,].map(i => now[0] +'Digit'+ i);
		old = [1,2,3,4,5,6,7,8,9,0,].map(i => old[0] +'Digit'+ i);
	}
	old.forEach(key => keyMap.delete(key));
	now.forEach(key => keyMap.set(key, command.name));
}));

dom.on(window, 'keydown', onKey, true);

return {
	setAction,
};

}); })(this);
