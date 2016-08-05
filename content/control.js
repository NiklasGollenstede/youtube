'use strict'; define('content/control', [
	'es6lib',
], function(
	{
		concurrent: { async, sleep, },
		format: { hhMmSsToSeconds, },
		object: { Class, },
	}
) {

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
		if (wanted && wanted !== "auto" && wanted !== quality.current) {
			console.log('setting quality to', wanted);
			(yield player.setQuality(wanted));
		}
	});

	main.on('navigated', async(function*() {
		const { videoId, } = main;
		if (!videoId) {
			console.log('player removed');
			return port.emit('player_removed');
		}

		(yield player.loaded);
		console.log('player loaded', player);

		const unMute = player.silence();

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

		unMute();

		const duration = hhMmSsToSeconds(player.root.querySelector('.ytp-time-duration').textContent);
		const titleElement = document.querySelector('#eow-title, .video-title span, .video-title');
		const title = titleElement && titleElement.textContent.trim();
		(yield port.request('db', 'assign', main.videoId, 'meta', title ? { title, duration, } : { duration, }));

		console.log('control done', title, duration, main.videoId);
		port.emit('player_created', main.videoId);
		play && port.emit('player_playing', player.video.currentTime || 0);
		reportState = true;

	}, error => console.error(error)));

	main.on('navigate', ({ url, }) => {
		console.log('navigate to', url);
		reportState = false;
	});

	player.on('ended', checkbox => (checkbox = document.querySelector('#autoplay-checkbox')) && checkbox.checked && checkbox.click());
};

});
