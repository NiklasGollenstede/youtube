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

	[ 'playing', 'videoCued', 'paused', 'ended', ]
	.forEach(event => player.on(event, () => {
		main.videoId && port.emitSoon('player_'+ event, main.videoId);
	}));

	port.on('play', () => console.log('control play') === player.play(true));
	port.on('pause', () => console.log('control pause') === player.pause(true));

	main.on('playerRemoved', () => port.emitSoon('player_removed'));
	main.on('playerCreated', () => port.emitSoon('player_created', main.videoId));


	main.on('playerCreated', async(function*({ options, player, }) {

		console.log('player loaded', player, options);

		const unMute = player.silence();

		// set quality
		const { available, current, } = (yield player.getQuality());
		const quality = (options.player.defaultQualities || [ ]).find(
			level => available.indexOf(level) != -1
		);
		if (quality && quality !== "auto" && quality !== current) {
			(yield player.setQuality(quality));
		}

		// play, stop or pause
		if (!options.player.pauseOnStart
			|| options.player.pauseOnStart.playOnNotHidden && !document.hidden
			|| options.player.pauseOnStart.playOnFocus && document.hasFocus()
		) {
			(yield player.play());
		} else if (options.player.pauseOnStart.preventBuffering) {
			(yield player.stop());
		} else {
			(yield player.pause());
		}

		unMute();

		const duration = hhMmSsToSeconds(document.querySelector('.ytp-time-duration').textContent);
		console.log('duration', duration);
		(yield port.request('assign', main.videoId, 'meta', { duration, }));

	}, error => console.error(error)));

	player.on('ended', checkbox => (checkbox = document.querySelector("#autoplay-checkbox")) && checkbox.checked && checkbox.click());
};

});
