'use strict'; define('content/layout', [
], function(
) {

let loaded = false;

return function(main) {
	const noop = document.createElement('p');

	main.once('playerCreated', init);

	main.on('playerCreated', ({ options, listId, }) => {

		// add watchpage & playlist css hints
		document.documentElement.classList.add('watchpage');
		document.documentElement.classList[listId ? 'add' : 'remove']('playlist');

		// use cinema mode to make progress-bar a bit larger
		options.player.cinemaMode && (document.querySelector('.ytp-size-button') || noop).click();

		// always display volume
		options.player.alwaysVolume && (document.querySelector('.ytp-volume-panel') || noop).classList.add('ytp-volume-control-hover');

		// disable annotations (and all other checkboxes in the player settings)
		if (!options.player.annotations) {
			document.querySelector('.ytp-settings-button').click();
			Array.prototype.forEach.call(document.querySelectorAll('#ytp-main-menu-id .ytp-menuitem[aria-checked="true"]'), button => button.click());
			document.querySelector('.ytp-settings-button').click();
		}
	});

	main.on('playerRemoved', remove);
	main.once(Symbol.for('destroyed'), remove);
	function remove() {
		document.documentElement.classList.remove('watchpage');
		document.documentElement.classList.remove('playlist');
	}

};

function init({ options, port, }) {

	// apply 'fullscreen' class to <html> as appropriate
	options.player.seamlessFullscreen.atStart && document.documentElement.classList.add('fullscreen');

	window.addEventListener('wheel', onWheel);
	port.once(Symbol.for('destroyed'), () => window.removeEventListener('wheel', onWheel));

	function onWheel(event) {
		if (event.ctrlKey && event.deltaY &&  event.target.matches('#player-api, #player-api *')) {
			event.preventDefault();
			scaleVideo(event, options.player.zoomFactor / 100);
		} else if (!event.ctrlKey && !event.altKey && !event.shiftKey
			&& options.player.seamlessFullscreen
			&& event.deltaY <= 0 && window.pageYOffset === 0
			&& event.target && event.target.matches
			&& !event.target.matches('#playlist-autoscroll-list *')
		) { // scroll to top
			options.player.seamlessFullscreen.showOnScrollTop && document.documentElement.classList.add('fullscreen');
		} else if (
			options.player.seamlessFullscreen.hideOnScrollDown
			&& document.documentElement.classList.contains('fullscreen')
		) {
			document.documentElement.classList.remove('fullscreen');
			window.scrollY === 0 && event.preventDefault();
		}
	}

	if (options.player.seamlessFullscreen && options.player.seamlessFullscreen.showOnMouseRight) {
		window.addEventListener('mousemove', onMouseMove);
		port.once(Symbol.for('destroyed'), () => window.removeEventListener('mousemove', onMouseMove));
	}

	function onMouseMove(event) {
		options.player.seamlessFullscreen && event.pageX < (options.player.seamlessFullscreen.showOnMouseRight || 0)
		&& document.documentElement.classList.add('fullscreen');
	}
}

function scaleVideo(event, factor = 1.1) {
	const video = document.querySelector('#player-api .html5-video-container video');
	const current = video.currentZoom || (video.currentZoom = { factor: 1, x: 0.5, y: 0.5, });
	const style = video.style;
	const divisor = 1 / factor;

	const rect = document.querySelector('#player-api').getBoundingClientRect();
	current.x = ((event.clientX - rect.left) / rect.width) * (1 - divisor) + current.x * divisor;
	current.y = ((event.clientY - rect.top) / rect.height) * (1 - divisor) + current.y * divisor;
	current.factor = event.deltaY < 0 ? (current.factor * factor) : (current.factor / factor);

	style.transform = style.transform.replace(/(scale\(.*?\)|none)?/, () => `scale(${ current.factor.toFixed(6) })`);
	style.transformOrigin = `${ (current.x * 100).toFixed(6) }% ${ (current.y * 100).toFixed(6) }%`;
}

});
