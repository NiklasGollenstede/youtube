(function(global) { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/concurrent': { _async, sleep, },
	'node_modules/es6lib/object': { Class, },
	'node_modules/es6lib/network': { HttpRequest, },
	'node_modules/es6lib/string': { hhMmSsToSeconds, timeToRoundString, },
}) {

let loaded = false;

return function(main) {
	const { player, port, } = main;

	let reportState = false;

	[ 'playing', 'paused', 'ended', ]
	.forEach(event => player.on(event, time => reportState && port.post('tab.player_'+ event, time)));

	const setQuality = _async(function*() {
		let quality, _try = 0; while (
			!(quality = (yield player.getQuality()))
			|| quality.current === 'unknown'
		) {
			if (++_try > 30) { return; }
			(yield sleep(33 + 10 * _try));
		}
		const wanted = (main.options.player.children.defaultQualities.values.current).find(level => quality.available.includes(level));
		if (!wanted || wanted === "auto") { return; }
		if (wanted !== quality.current) {
			(yield player.setQuality(wanted));
		} else {
			player.setQuality(wanted);
		}
	});

	// update the private view count
	const displayViews = () => sleep(300)
	.then(() => port.request('db.get', main.videoId, [ 'meta', 'viewed', ]))
	.then(({ meta: { duration, }, viewed, }) => {
		viewed = viewed || 0;
		const views = document.querySelector('.watch-view-count');
		delete views.dataset.tooltipText;
		views.title = (duration ? (viewed / duration).toFixed(1).replace('.0', '') +' times' : timeToRoundString(viewed * 1000, 1.7)) +' by you';
		views.classList.add('yt-uix-tooltip');
		views.style.display = 'block';
	});
	[ 'paused', 'ended', ].forEach(event => player.on(event, displayViews));

	player.on('buffering', time => {
		if (!reportState || time < 2.5 || time > 6) { return; }
		console.log('forcing play on buffer');
		player.play();
		player.video.play();
	});

	// increase quality of the video poster
	let posters = new Map;
	player.on('unstarted', _async(function*() {
		const blob = posters.get(main.videoId) || (yield HttpRequest(`https://i.ytimg.com/vi/${ main.videoId }/maxresdefault.jpg`, { responseType: 'blob', })).response;
		posters.set(main.videoId, blob);
		main.setStyle('hd-poster', String.raw`.ytp-thumbnail-overlay-image {
			background-image: url("${ URL.createObjectURL(blob) }") !important;
		}`);
	}), error => console.info('failed to load poster', error));

	// set initial video quality and playback state according to the options and report to the background script
	main.on('navigated', _async(function*() {
		reportState = false;
		const { videoId, } = main;
		if (!videoId) {
			console.log('player removed');
			return port.post('tab.player_removed');
		}

		(yield resolveBefore(player.promise('loaded', 'unloaded'), main.promise('navigated')));
		console.log('player loaded', videoId);
		port.post('tab.mute_start');

		// play, stop or pause
		const should = main.options.player.children.onStart.value;
		const play = !should
		|| should === 'visible' && !document.hidden
		|| should === 'focused' && document.hasFocus();
		if (play) {
			console.log('control at load play');
			(yield setQuality());
			(yield player.play()) < 20 && (yield player.seekTo(0));
		} else if (
			main.options.player.children.onStart.children.stop.value
			&& (yield player.getLoaded()) < 0.5
		) {
			console.log('control at load stop');
			player.once('playing', setQuality);
			(yield player.stop());
		} else {
			console.log('control at load pause');
			(yield setQuality());
			(yield player.pause()) < 20 && (yield player.seekTo(0));
		}

		port.post('tab.mute_stop');

		const duration = hhMmSsToSeconds(player.root.querySelector('.ytp-time-duration').textContent); // TODO: this may use the duration of an ad
		const titleElement = document.querySelector('#eow-title, .video-title span, .video-title');
		const title = titleElement && titleElement.textContent.trim();
		const info = { }; title && (info.title = title); duration && (info.duration = duration);
		(yield port.request('db.assign', main.videoId, 'meta', info));

		console.log('control done', title, duration, player.root.querySelector('.ytp-time-duration').textContent, main.videoId);
		port.post('tab.player_created', main.videoId);
		play && port.post('tab.player_playing', player.video.currentTime || 0);
		reportState = true;
		(yield displayViews());

	}, error => console.error(error)));

	player.on('ended', checkbox => (checkbox = document.querySelector('#autoplay-checkbox')) && checkbox.checked && checkbox.click());
};

function resolveBefore(good, bad) {
	return Promise.race([
		good,
		typeof bad === 'number'
		? sleep(bad).then(() => { throw new Error(`Operation was canceled after ${ bad }ms`); })
		: bad.then(() => { throw new Error(`Operation was canceled`); }),
	]);
}

}); })((function() { /* jshint strict: false */ return this; })());
