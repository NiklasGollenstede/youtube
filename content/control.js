'use strict'; define('content/control', [
	'es6lib', 'common/event-emitter',
], function(
	{
		concurrent: { async, },
		object: { Class, },
	},
	EventEmitter
) {

const Port = new Class({
	extends: { public: require('common/event-emitter'), },

	constructor: (Super, Private, Protected) => (function(port) {
		Super.call(this);
		const self = Private(this);
		self.port = port;
		const _this = Protected(this);
		port.onMessage.addListener(({ type, value, }) => _this.emitSync(type, value));
	}),

	public: (Private, Protected, Public) => ({
		emit(type, value) {
			const self = Private(this);
			self.port.postMessage({ type, value, });
		},
		emitSoon(type, value) {
			clearTimeout(this.timeoutHandler);
			this.timeoutHandler = setTimeout(() => this.emit(type, value), 300);
		},
	}),

	private: (Private, Protected, Public) => ({
	}),
});

let loaded = false;

return function(main) {
	const noop = document.createElement('p');

	let port;

	main.once('playerCreated', ({ player, }) => {

		port = main.port = new Port(chrome.runtime.connect());

		[ 'playing', 'videoCued', 'paused', 'ended', ]
		.forEach(event => player.on(event, () => {
			main.videoId && port.emitSoon('player_'+ event, main.videoId);
		}));

		port.on('play', () => console.log('control play') === player.play(true));
		port.on('pause', () => console.log('control pause') === player.pause(true));

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

});
