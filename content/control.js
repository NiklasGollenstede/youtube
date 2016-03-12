'use strict'; define('content/control', [
	'es6lib',
], function(
	{
		concurrent: { async, },
	}
) {

let loaded = false;

return function(main) {
	const noop = document.createElement('p');

	let port;

	main.once('playerCreated', ({ player, }) => {

		port = extendPort(chrome.runtime.connect());

		[ 'playing', 'videoCued', 'paused', 'ended', ]
		.forEach(event => player.on(event, () => {
			main.videoId && port.emitSoon('player_'+ event, main.videoId);
		}));

		port.onMessage.addListener(({ type, args, }) => ({
			play() {
				console.log('control play');
				player.play();
			},
			pause() {
				console.log('control pause');
				player.pause();
			},
		})[type](...args));

		port.emitSoon('player_created', main.videoId);
		main.on('playerRemoved', () => port.emitSoon('player_removed'));
		main.on('playerCreated', () => port.emitSoon('player_created', main.videoId));
	});


	main.on('playerCreated', async(function*({ options, player, }) {

		console.log('player loaded', player, options);

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
			// keep playing
		} else if (options.player.pauseOnStart.preventBuffering) {
			(yield player.stop());
		} else {
			(yield player.pause());
		}

	}, error => console.error(error)));

	main.player.on('ended', checkbox => (checkbox = document.querySelector("#autoplay-checkbox")) && checkbox.checked && checkbox.click());
};

function extendPort(port) {
	port.emit = function(type, ...args) { this.postMessage({ type, args, }); };
	let timeoutHandler;
	port.emitSoon = function(type, ...args) {
		clearTimeout(timeoutHandler);
		timeoutHandler = setTimeout(() => this.postMessage({ type, args, }), 300);
	};
	return port;
}

});
