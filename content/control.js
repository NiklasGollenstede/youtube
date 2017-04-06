(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/concurrent': { sleep, before, },
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/es6lib/network': { HttpRequest, },
	'node_modules/es6lib/string': { timeToRoundString, },
}) => { /* global document, URL, */

return function(main) {
	const { player, port, } = main;

	let reportState = false;

	[ 'playing', 'paused', 'ended', ]
	.forEach(event => player.on(event, time => reportState && port.post('tab.player_'+ event, time)));

	async function setQuality() {
		let quality, _try = 0; while (
			!(quality = (await player.getQuality()))
			|| quality.current === 'unknown'
		) {
			if (++_try > 30) { return; }
			(await sleep(33 + 10 * _try));
		}
		const wanted = (main.options.player.children.defaultQualities.values.current).find(level => quality.available.includes(level));
		if (!wanted || wanted === "auto") { return; }
		if (wanted !== quality.current) {
			(await player.setQuality(wanted));
		} else {
			player.setQuality(wanted);
		}
	}
	player.on('playing', debounce(setQuality, 1000));

	// update the private view count
	async function displayViews() {
		(await sleep(300)); // allow the view counter to be updated
		const { duration, } = (await player.getInfo());
		const { viewed = 0, } = (await port.request('db.get', main.videoId, [ 'viewed', ]));
		const views = document.querySelector('.watch-view-count');
		delete views.dataset.tooltipText;
		views.title = (duration ? (viewed / duration).toFixed(1).replace('.0', '') +' times' : timeToRoundString(viewed * 1000, 1.7)) +' by you';
		views.classList.add('yt-uix-tooltip');
		views.style.display = 'block';
	}
	player.on('paused', displayViews); player.on('ended', displayViews);

	player.on('buffering', async time => {
		if (!reportState || time < 2.5 || time > 8) { return; }
		console.log('forcing play on buffer');
		player.play(); player.video.play();
		if ((await before(player.promise('playing'), sleep(2000)))) { return; }
		// didn't start within 2000 ms
		console.log('still buffering, seeking by +1 sec');
		(await player.seekTo(time + 1));
		if ((await before(player.promise('playing'), sleep(5000)))) { return; }
		console.log('still not playing -.-');
	});

	// increase quality of the video poster
	const posters = new Map;
	player.on('unstarted', async () => {
		if (!main.videoId) { return; }
		const blob = posters.get(main.videoId) || (await HttpRequest(`https://i.ytimg.com/vi/${ main.videoId }/maxresdefault.jpg`, { responseType: 'blob', })).response;
		posters.set(main.videoId, blob);
		main.setStyle('hd-poster', String.raw`.ytp-thumbnail-overlay-image {
			background-image: url("${ URL.createObjectURL(blob) }") !important;
		}`);
	});

	// set initial video quality and playback state according to the options and report to the background script
	main.on('navigated', async () => {
		reportState = false;
		const { videoId, } = main;
		if (!videoId) {
			console.log('player removed');
			return void port.post('tab.player_removed');
		}

		if (!player.root && (await before(main.promise('navigated'), player.promise('loaded', 'unloaded')))) { return void console.log('cancel navigation'); }
		console.log('player loaded', videoId);
		port.post('tab.mute_start');

		// play, stop or pause
		const should = main.options.player.children.onStart.value;
		const play = !should
		|| should === 'visible' && !document.hidden
		|| should === 'focused' && document.hasFocus();
		if (play) {
			console.log('control at load: play');
			(await setQuality());
			(await player.play(false)) < 20 && (await player.seekTo(0));
		} else if (
			main.options.player.children.onStart.children.stop.value
			&& (await player.getLoaded()) < 0.5
		) {
			console.log('control at load: stop');
			(await player.stop());
		} else {
			console.log('control at load: pause');
			(await setQuality());
			(await player.pause(false)) < 20 && (await player.seekTo(0));
		}

		!play && (player.video.volume = 0);
		!play && player.once('playing', () => player.unMute());
		port.post('tab.mute_stop');

		console.log('control done', main.videoId);
		port.post('tab.player_created', (await player.getInfo()));
		play && port.post('tab.player_playing', player.video.currentTime || 0);
		reportState = true;
		displayViews();
	});

	player.on('ended', checkbox => (checkbox = document.querySelector('#autoplay-checkbox')) && checkbox.checked && checkbox.click());
};

}); })(this);
