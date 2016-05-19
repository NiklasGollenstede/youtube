'use strict'; define('content/actions', [
	'web-ext-utils/chrome', 'content/templates', 'es6lib',
], function(
	{ applications: { gecko, chromium, }, },
	Templates,
	{
		concurrent: { async, spawn, sleep, timeout, },
		dom: { clickElement, createElement, CreationObserver, notify, once, saveAs, },
		format: { hhMmSsToSeconds, secondsToHhMmSs, numberToRoundString, timeToRoundString, QueryObject, },
		functional: { noop, Logger, log, },
		object: { copyProperties, },
		network: { HttpRequest, },
	}
) {


const actions = {
	videoIncreaseQuality({ player, }) {
		player.getQuality().then(({ available, current, }) => {
			const quality = available[available.indexOf(current) - 1];
			quality && player.setQuality(quality);
		});
	},
	videoDecreaseQuality({ player, }) {
		player.getQuality().then(({ available, current, }) => {
			const quality = available[available.indexOf(current) + 1];
			quality && player.setQuality(quality);
		});
	},
	videoIncreaseSpeed({ player, }) {
		player.getSpeed().then(({ available, current, }) => {
			const speed = available[available.indexOf(current) + 1];
			speed && player.setSpeed(speed);
		});
	},
	videoDecreaseSpeed({ player, }) {
		player.getSpeed().then(({ available, current, }) => {
			const speed = available[available.indexOf(current) - 1];
			speed && player.setSpeed(speed);
		});
	},
	videoToggleFullscreen() {
		document.querySelector('.ytp-fullscreen-button').click();
	},
	videoPromptPosiotion({ player, }) {
		let seconds = hhMmSsToSeconds(prompt('Seek to (hh:mm:SS.ss): '));
		if (seconds >= 0) {
			player.seekTo(seconds);
		}
	},
	videoPromptVolume({ player, }) {
		player.volume(Math.min(Math.max(0, parseInt(prompt('Volume in %: '))), 100) || 0);
	},
	playlistNext({ player, }) {
		player.next();
	},
	playlistPrevious({ player, }) {
		player.previous();
	},
	playlistToggleShuffle() {
		document.querySelector('.shuffle-playlist').click();
	},
	playlistToggleLoop() {
		document.querySelector('.toggle-loop').click();
	},
	playlistClear({ player, }) {
		let queryObject = new QueryObject(window.location.search);
		if (!queryObject.list) { return; }
		delete queryObject.list;
		delete queryObject.index;
		queryObject.t = Math.floor(player.getTime());
		window.location = window.location.href.split('?')[0] +'?'+ queryObject.toString();
	},
	videoTogglePause({ player, }) {
		player.togglePlayPause(true);
	},
	videoPlay({ player, }) {
		player.play(true);
	},
	videoPause({ player, }) {
		player.pause(true);
	},
	videoStop({ player, }) {
		player.stop();
	},
	videoStart({ player, }) {
		player.start(true);
	},
	videoEnd({ player, }) {
		player.end();
	},
	videoToggleMute({ player, }) {
		player.toggleMute();
	},
	videoToggleInfoScreen({ player, }) {
		let element = document.querySelector('.html5-video-info-panel');
		if (!element || element.style.display === 'none') {
			player.showVideoInfo();
		} else {
			player.hideVideoInfo();
		}
	},
	videoPushScreenshot({ player, }) {
		const { video, } = player;
		if (!video || !video.videoWidth || !video.videoHeight) { return; }
		let canvas, time = video.currentTime;
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
					gecko && (document.fullscreenElement ? document.exitFullscreen() : canvas.requestFullscreen());
					chromium && (document.webkitFullscreenElement ? document.webkitExitFullscreen() : canvas.webkitRequestFullscreen());
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
	videoSave({ player, }) { // works only with simple html-player
		let url = player.video.src;
		const title = document.querySelector('#eow-title').textContent;
		if (url.startsWith('mediasource:')) {
			url = `https://i.ytimg.com/vi/${ new QueryObject(location.search).v }/maxresdefault.jpg`;
		}
		saveAs(url +'?title='+ encodeURIComponent(title), title +'.jpg');
	},
	videoDownloadCover() {
		const url = `https://i.ytimg.com/vi/${ new QueryObject(location.search).v }/maxresdefault.jpg`;
		const title = (document.querySelector('#eow-title') || { textContent: 'cover', }).textContent;
		HttpRequest({ url, responseType: 'blob', })
		.then(({ response, }) => saveAs(response, title +'.jpg'))
		.catch(error => saveAs(url, title +'.jpg'));
	},
	openRelatedModifier(_, { key, }) {
		document.querySelectorAll('li.video-list-item.related-list-item')[key - 1].querySelector('a').click();
	}
};

return class Actions {
	constructor(main) {
		this.main = main;
		this.keyMap = new Map;
		this.main.addDomListener(window, 'keydown', this._key.bind(this), true);
		main.once('optionsLoaded', this._optionsLoaded.bind(this));
		console.log('message');
	}

	setAction(name, action) {
		return (actions[name] = action);
	}

	_optionsLoaded() {
		this.options = this.main.options;
		this.options.keys.children.forEach(command => command.whenChange((_, { current, }, old) => {
			if (command.name === 'openRelatedModifier') {
				current = [1,2,3,4,5,6,7,8,9,0].map(i => _ +'Digit'+ i);
				old = old && [1,2,3,4,5,6,7,8,9,0].map(i => old[0] +'Digit'+ i);
			}
			old && old.forEach(this.keyMap.delete.bind(this.keyMap));
			current.forEach(key => this.keyMap.set(key, command.name));
		}));
	}

	_key(event) {
		if (event.target && (event.target.tagName == 'INPUT' || event.target.tagName == 'TEXTAREA')) { return; }
		const key = (event.ctrlKey ? 'Ctrl+' : '') + (event.altKey ? 'Alt+' : '') + (event.shiftKey ? 'Shift+' : '') + event.code;
		const name = this.keyMap.get(key);
		if (!name || !actions[name]) { return; }
		console.log('keypress', key, name);
		event.stopPropagation(); event.preventDefault();
		actions[name](this.main, event);
	}
};

});
