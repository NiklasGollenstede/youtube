'use strict'; define('content/layout', [
], function(
) {

let loaded = false;

return function(main) {
	const noop = document.createElement('p');

	main.once('playerCreated', init);

	// remove any tooltips youtube forgot to remove
	/* should not be necessary */ // Array.prototype.forEach.call(document.querySelectorAll('.yt-uix-tooltip-tip'), item => item.remove());

	main.on('playerCreated', ({ options, }) => {

		// add watchpage & playlist css hints
		document.documentElement.classList.add('watchpage');
		document.documentElement.classList[
			(/list=[0-9A-z\-\_]{12,}/).test(window.location.search) ? 'add' : 'remove'
		]('playlist');

		// use cinema mode to make progress-bar a bit larger
		options.player.cinemaMode && (document.querySelector(".ytp-size-button") || noop).click();

		// always display volume
		options.player.alwaysVolume && (document.querySelector(".ytp-volume-panel") || noop).classList.add("ytp-volume-control-hover");

		// disable annotations (and all other checkboxes in the player settings)
		if (!options.player.annotations) {
			document.querySelector('.ytp-settings-button').click();
			Array.prototype.forEach.call(document.querySelectorAll('#ytp-main-menu-id .ytp-menuitem[aria-checked="true"]'), button => button.click());
			document.querySelector('.ytp-settings-button').click();
		}
	});

	main.on('playerRemoved', () => {
		// remove watchpage & playlist css hints
		document.documentElement.classList.remove('watchpage');
		document.documentElement.classList.remove('playlist');
	});
};

function init({ options, }) {

	// apply 'fullscreen' class to <html> as appropriate
	options.player.seamlessFullscreen.atStart && document.documentElement.classList.add('fullscreen');

	window.addEventListener('wheel', event => {
		if (event.ctrlKey && event.deltaY &&  event.target.matches('#player-api, #player-api *')) {
			event.preventDefault();
			scaleVideo(event, options.player.zoomFactor / 100);
		} else if (!event.ctrlKey && !event.altKey && !event.shiftKey
			&& options.player.seamlessFullscreen
			&& event.deltaY <= 0 && window.pageYOffset === 0
			&& event.target && event.target.matches
			// && document.documentElement.classList.contains('watchpage')
			&& !event.target.matches('#playlist-autoscroll-list *')
		) { // scroll to top
			options.player.seamlessFullscreen.showOnScrollTop && document.documentElement.classList.add('fullscreen');
		} else {
			options.player.seamlessFullscreen.hideOnScrollDown && document.documentElement.classList.remove('fullscreen');
		}
	});

	options.player.seamlessFullscreen && options.player.seamlessFullscreen.showOnMouseRight && window.addEventListener('mousemove', event => {
		options.player.seamlessFullscreen && event.pageX < (options.player.seamlessFullscreen.showOnMouseRight || 0)
		&& document.documentElement.classList.add('fullscreen');
	});
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

	style.setProperty('width', (current.factor * 100).toFixed(6) +'%', 'important');
	style.setProperty('height', (current.factor * 100).toFixed(6) +'%', 'important');
	style.marginLeft = (current.x * (1 - current.factor) * 100).toFixed(6) +'%';
	style.marginTop = (current.y * (1 - current.factor) * 100).toFixed(6) +'%';
}

});
