'use strict'; define('content/control', [
	'es6lib',
], function(
	{
		concurrent: { async, },
		format: { hhMmSsToSeconds, },
		object: { Class, },
	}
) {

let loaded = false;

return function(main) {
	const { options, player, port, } = main;

	let reportState = false;

	[ 'playing', 'videoCued', 'paused', 'ended', ]
	.forEach(event => player.on(event, () => reportState && port.emit('player_'+ event, main.videoId)));

	port.on('play', () => console.log('control play') === player.play(true));
	port.on('pause', () => console.log('control pause') === player.pause(true));

	main.on('navigated', async(function*() {
		const { videoId, } = main;
		if (!videoId) {
			console.log('player removed');
			return port.emit('player_removed');
		}

		console.log('player loaded', player, options);

		const unMute = player.silence();

		// set quality
		const { available, current, } = (yield player.getQuality());
		const quality = (options.player.defaultQualities || [ ]).find(level => available.includes(level));
		if (quality && quality !== "auto" && quality !== current) {
			(yield player.setQuality(quality));
		}

		// play, stop or pause
		const play = options.player.onStart === 'play'
		|| options.player.onStart === 'visible' && !document.hidden
		|| options.player.onStart === 'focused' && document.hasFocus();
		if (play) {
			(yield player.play());
		} else if (options.player.onStart === 'stop') {
			(yield player.stop());
		} else {
			(yield player.pause());
		}

		unMute();

		const duration = hhMmSsToSeconds(player.root.querySelector('.ytp-time-duration').textContent);
		const title = document.querySelector('#eow-title').textContent;
		(yield port.request('assign', main.videoId, 'meta', { title, duration, }));

		console.log('control done', title, duration, main.videoId);
		port.emit('player_created', main.videoId);
		play && port.emit('player_playing', main.videoId);
		reportState = true;

	}, error => console.error(error)));

	main.on('navigate', ({ url, }) => {
		console.log('navigate to', url);
		reportState = false;
	});

	player.on('ended', checkbox => (checkbox = player.root.querySelector("#autoplay-checkbox")) && checkbox.checked && checkbox.click());
};

});
