'use strict'; define('content/actions', [
	'common/chrome', 'content/utils', 'content/templates', 'es6lib',
], function(
	{ storage, },
	{ getVideoIdFromImageSrc, },
	Templates,
	{
		concurrent: { async, spawn, sleep, timeout, },
		dom: { clickElement, createElement, CreationObserver, notify, once, saveAs, },
		format: { hhMmSsToSeconds, numberToRoundString, timeToRoundString, QueryObject, },
		functional: { noop, Logger, log, },
		object: { copyProperties, },
		network: { HttpRequest, },
	}
) {

function updateKeyMap(settings) {
	settings.keyMap = { };
	Object.keys(settings.keys).forEach(command => settings.keys[command].forEach(shortcut => settings.keyMap[shortcut] = command));
	for (let i = 1; i <= 10; i++) {
		settings.keyMap[settings.keys.openRelatedModifier +'Digit'+ (i % 10)] = 'openRelated'+ i;
	}
}


const actions = {
	videoIncreaseQuality(player) {
		player.getQuality().then(({ available, current, }) => {
			const quality = available[available.indexOf(current) - 1];
			quality && player.setQuality(quality);
		});
	},
	videoDecreaseQuality(player) {
		player.getQuality().then(({ available, current, }) => {
			const quality = available[available.indexOf(current) + 1];
			quality && player.setQuality(quality);
		});
	},
	videoIncreaseSpeed(player) {
		player.getSpeed().then(({ available, current, }) => {
			const speed = available[available.indexOf(current) + 1];
			speed && player.setSpeed(speed);
		});
	},
	videoDecreaseSpeed(player) {
		player.getSpeed().then(({ available, current, }) => {
			const speed = available[available.indexOf(current) - 1];
			speed && player.setSpeed(speed);
		});
	},
	videoToggleFullscreen(player) {
		document.querySelector('.ytp-button-fullscreen-enter, .ytp-button-fullscreen-exit').click();
	},
	videoPromptPosiotion(player) {
		let seconds = hhMmSsToSeconds(prompt('Seek to (hh:mm:SS.ss): '));
		if (seconds >= 0) {
			player.seekTo(seconds);
		}
	},
	videoPromptVolume(player) {
		player.volume(Math.min(Math.max(0, parseInt(prompt('Volume in %: '))), 100) || 0);
	},
	playlistNext(player) {
		player.next();
	},
	playlistPrevious(player) {
		player.previous();
	},
	playlistToggleShuffle(player) {
		document.querySelector('.shuffle-playlist').click();
	},
	playlistToggleLoop(player) {
		document.querySelector('.toggle-loop').click();
	},
	playlistClear(player) {
		let queryObject = new QueryObject(window.location.search);
		if (!queryObject.list) { return; }
		delete queryObject.list;
		delete queryObject.index;
		queryObject.t = Math.floor(player.getTime());
		window.location = window.location.href.split('?')[0] +'?'+ queryObject.toString();
	},
	videoTogglePause(player) {
		player.togglePlayPause(true);
	},
	videoPlay(player) {
		player.play(true);
	},
	videoPause(player) {
		player.pause(true);
	},
	videoStop(player) {
		player.stop();
	},
	videoStart(player) {
		player.start(true);
	},
	videoEnd(player) {
		player.end();
	},
	videoToggleMute(player) {
		player.toggleMute();
	},
	videoToggleInfoScreen(player) {
		let element = document.querySelector('.html5-video-info-panel');
		if (!element || element.style.display === 'none') {
			player.showVideoInfo();
		} else {
			player.hideVideoInfo();
		}
	},
	videoPushScreenshot(player) {
		const video = document.querySelector('.html5-main-video, video');
		if (!video.videoWidth || !video.videoHeight) { return; }
		let canvas, time, timeSeconds;
		document.getElementById('watch7-content').appendChild(createElement('div', {
			className: 'yt-card yt-card-has-padding screenshot-preview',
			style: { position: 'relative', },
		}, [
			canvas = createElement('canvas', {
				width: video.videoWidth,
				height: video.videoHeight,
				style: { maxWidth: '100%', },
			}),
			time = createElement('span', {
				className: 'video-time yt-uix-tooltip',
				style: {
					position: 'absolute',
					right: '12px',
					bottom: '12px',
					cursor: 'pointer',
				},
				textContent: document.querySelector('.ytp-time-current').textContent,
				onclick: event => player.seekTo(timeSeconds),
			}),
			createElement('button', {
				className: 'yt-uix-button yt-uix-button-size-default yt-uix-button-default',
				style: {
					position: 'absolute',
					right: '12px',
					top: '12px',
				},
				textContent: '⨉',
				onclick: event => event.target.parentNode.remove(),
			}),
		]));
		canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
		player.getTime().then(value => (time.title = value.toFixed(2) +'s') && (timeSeconds = value)); // TODO: use video.currentTime instead (?)
	},
	videoPopScreenshot(player) {
		document.querySelector('.screenshot-preview').remove();
	},
	videoSave(player) { // works only with simple html-player
		let url = document.querySelector('.html5-main-video').src;
		if (url.startsWith('mediasource:')) {
			url = `https://i.ytimg.com/vi/${ new QueryObject(location.search).v }/maxresdefault.jpg`;
		}
		clickElement(createElement('a', { href: url, download: url.match(/\/([^\/]*)$/)[1], target: '_blank'}));
	},
	videoDownloadCover(player) {
		const url = `https://i.ytimg.com/vi/${ new QueryObject(location.search).v }/maxresdefault.jpg`;
		const title = document.querySelector('#eow-title').textContent;
		saveAs(url +'?title='+ encodeURIComponent(title), title +'.jpg');
		return;
		HttpRequest({ url, responseType: 'blob', })
		.then(({ response, }) => {
			saveAs(response, title +'.jpg');
		})
		.catch(Logger('Faild to load maxresdefault.jpg'));
	},
};
[1,2,3,4,5,6,7,8,9,10].forEach(i => {
	actions['openRelated'+ i] = () => document.querySelectorAll('li.video-list-item.related-list-item')[i - 1].querySelector('a').click();
});

return class Actions {
	constructor(main) {
		this.main = main;
		main.once('optionsLoaded', this._optionsLoaded.bind(this));
	}

	setAction(name, action) {
		return (actions[name] = action);
	}

	_optionsLoaded() {
		this.options = this.main.options;
		this.player = this.main.player;
		this.main.addDomListener(window, 'keypress', this._keyPress.bind(this), true);
		updateKeyMap(this.options);
	}

	_keyPress(event) {
		if (event.target && (event.target.tagName == 'INPUT' || event.target.tagName == 'TEXTAREA')) { return; }
		const key = (event.ctrlKey ? 'Ctrl+' : '') + (event.altKey ? 'Alt+' : '') + (event.shiftKey ? 'Shift+' : '') + event.code;
		const name = this.options.keyMap[key];
		console.log('keypress', key, name);
		if (!name || !actions[name]) { return; }
		event.stopPropagation(); event.preventDefault();
		actions[name](this.player);
	}
};

});
