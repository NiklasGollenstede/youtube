'use strict'; define('content/control', [
	'es6lib', 'common/event-emitter',
], function(
	{
		concurrent: { async, },
		format: { hhMmSsToSeconds, },
		object: { Class, },
	},
	EventEmitter
) {

let loaded = false;

return function(main) {
	const { player, port, } = main;

	let reportState = false;

	[ 'playing', 'videoCued', 'paused', 'ended', ]
	.forEach(event => player.on(event, () => reportState && port.emit('player_'+ event, main.videoId)));

	port.on('play', () => console.log('control play') === player.play(true));
	port.on('pause', () => console.log('control pause') === player.pause(true));

	main.on('navigated', async(function*({ options, player, videoId, }) {
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
		let playing = false;
		if (!options.player.pauseOnStart
			|| options.player.pauseOnStart.playOnNotHidden && !document.hidden
			|| options.player.pauseOnStart.playOnFocus && document.hasFocus()
		) {
			(yield player.play());
			playing = true;
		} else if (options.player.pauseOnStart.preventBuffering) {
			(yield player.stop());
		} else {
			(yield player.pause());
		}

		unMute();

		const duration = hhMmSsToSeconds(document.querySelector('.ytp-time-duration').textContent);
		const title = document.querySelector('#eow-title').textContent;
		(yield port.request('assign', main.videoId, 'meta', { title, duration, }));

		console.log('control done', title, duration, main.videoId);
		port.emit('player_created', main.videoId);
		playing && port.emit('player_playing', main.videoId);
		reportState = true;

	}, error => console.error(error)));

	main.on('navigate', ({ navigationTarget: { url, }, }) => {
		console.log('navigate to', url);
		reportState = false;
	});

	player.on('ended', checkbox => (checkbox = document.querySelector("#autoplay-checkbox")) && checkbox.checked && checkbox.click());
};

});
