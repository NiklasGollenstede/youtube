(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/concurrent': { async, sleep, },
	'node_modules/es6lib/format': { hhMmSsToSeconds, timeToRoundString, },
	'node_modules/es6lib/object': { Class, },
	'node_modules/es6lib/network': { HttpRequest, },
}) {

let loaded = false;

return function(main) {
	const { player, port, } = main;

	let reportState = false;

	[ 'playing', 'paused', 'ended', ]
	.forEach(event => player.on(event, time => reportState && port.emit('player_'+ event, time)));

	port.on('play', () => console.log('control play') === player.play(true));
	port.on('pause', () => console.log('control pause') === player.pause(true));

	const setQuality = async(function*() {
		let quality, _try = 0; while (
			!(quality = (yield player.getQuality()))
			|| quality.current === 'unknown'
		) {
			if (++_try > 30) { return; }
			(yield sleep(33 + 10 * _try));
		}
		console.log('current quality', quality);
		const wanted = (main.options.player.children.defaultQualities.values.current).find(level => quality.available.includes(level));
		if (!wanted || wanted === "auto") { return; }
		console.log('setting quality to', wanted);
		if (wanted !== quality.current) {
			(yield player.setQuality(wanted));
		} else {
			player.setQuality(wanted);
		}
	});

	// update the private view count
	const displayViews = () => sleep(300)
	.then(() => port.request('db', 'get', main.videoId, [ 'meta', 'viewed', ]))
	.then(({ meta: { duration, }, viewed, }) => {
		viewed = viewed || 0;
		const views = document.querySelector('.watch-view-count');
		delete views.dataset.tooltipText;
		views.title = (duration ? (viewed / duration).toFixed(1).replace('.0', '') +' times' : timeToRoundString(viewed * 1000, 1.7)) +' by you';
		views.classList.add('yt-uix-tooltip');
		views.style.display = 'block';
	});
	[ 'paused', 'ended', ].forEach(event => player.on(event, displayViews));

	// increase quality of the video poster
	let lastVideoId;
	player.on('unstarted', () => {
		if (lastVideoId === main.videoId) { return; } lastVideoId = main.videoId;
		return HttpRequest(`https://i.ytimg.com/vi/${ main.videoId }/maxresdefault.jpg`, { responseType: 'blob', })
		.then(({ response: blob, }) => main.setStyle('hd-poster', String.raw`.ytp-thumbnail-overlay-image {
			background-image: url("${ URL.createObjectURL(blob) }") !important;
		}`)).catch(() => void 0);
	});

	// set initial video quality and playback state according to the options and report to the background script
	main.on('navigated', async(function*() {
		const { videoId, } = main;
		if (!videoId) {
			console.log('player removed');
			return port.emit('player_removed');
		}

		(yield resolveBefore(player.loaded, cancel => main.once('navigated', cancel)));
		console.log('player loaded', videoId);
		port.emit('mute_start');

		// play, stop or pause
		const should = main.options.player.children.onStart.value;
		const play = !should
		|| should === 'visible' && !document.hidden
		|| should === 'focused' && document.hasFocus();
		if (play) {
			(yield setQuality());
			(yield player.play());
		} else {
			if (
				main.options.player.children.onStart.children.stop.value
				&& (yield player.getLoaded()) < 0.5
			) {
				(yield player.stop());
				player.once('unstarted', setQuality);
			} else {
				(yield setQuality());
			}
		}

		port.emit('mute_stop');

		const duration = hhMmSsToSeconds(player.root.querySelector('.ytp-time-duration').textContent); // TODO: this may use the duration of an ad
		const titleElement = document.querySelector('#eow-title, .video-title span, .video-title');
		const title = titleElement && titleElement.textContent.trim();
		const info = { }; title && (info.title = title); duration && (info.duration = duration);
		console.log('sending data', info);
		(yield port.request('db', 'assign', main.videoId, 'meta', info));

		console.log('control done', title, duration, player.root.querySelector('.ytp-time-duration').textContent, main.videoId);
		port.emit('player_created', main.videoId);
		play && port.emit('player_playing', player.video.currentTime || 0);
		reportState = true;
		(yield displayViews());

	}, error => console.error(error)));

	main.on('navigate', ({ url, }) => {
		console.log('navigate to', url);
		reportState = false;
	});

	player.on('ended', checkbox => (checkbox = document.querySelector('#autoplay-checkbox')) && checkbox.checked && checkbox.click());
};

function resolveBefore(promise, before) {
	return new Promise((resolve, reject) => {
		promise.then(resolve);
		typeof before === 'function'
		? before(() => reject(new Error(`Operation was cancelled`)))
		: setTimeout(() => reject(new Error(`Operation was cancelled after ${ before }ms`)), before);
	});
}

}); })();
