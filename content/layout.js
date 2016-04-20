'use strict'; define('content/layout', [
	'content/utils', 'es6lib',
], function(
	{ getVideoIdFromImageSrc, },
	{
		dom: { createElement, once, },
	}
) {

const noop = document.createElement('p');

return class Layout {
	constructor(main) {
		this.scale = 1;
		this.scaleX = this.scaleY = 0.5;
		this.zoom = main.addStyle('');
		this.setZoom();
		this.main = main;
		this.options = null;

		main.once('optionsLoaded', this.optionsLoaded.bind(this));

		main.on('navigated', this.navigated.bind(this));

		main.once(Symbol.for('destroyed'), () => {
			document.documentElement.classList.remove('watchpage');
			document.documentElement.classList.remove('playlist');
		});
	}

	optionsLoaded({ value: options, }) {
		this.options = options;
		options.player.seamlessFullscreen && this.enableFullscreen();
		options.animateThumbs && this.enableAnimatedThumbs();
		this.options.player.zoomFactor && this.enableVideoZoom();
		this.enableVideoAutoZoom();
	}

	navigated() {
		const { options, videoId, listId, player, } = this.main;
		if (!videoId) {
			return document.documentElement.classList.remove('watchpage');
		}

		// add watchpage & playlist css hints
		document.documentElement.classList.add('watchpage');
		document.documentElement.classList[listId ? 'add' : 'remove']('playlist');

		if (player.root) { withPlayerElement(player.root); } else { player.once('playerElementAdded', withPlayerElement); }
		function withPlayerElement(element) {
			// use cinema mode to make progress-bar a bit larger
			options.player.cinemaMode && (element.querySelector('.ytp-size-button') || noop).click();

			// always display volume
			options.player.alwaysVolume && (element.querySelector('.ytp-volume-panel') || noop).classList.add('ytp-volume-control-hover');

			// disable annotations (and all other checkboxes in the player settings)
			if (!options.player.annotations) { hide(); setTimeout(hide, 5e4); setTimeout(hide, 12e4); }
			function hide() {
				element.querySelector('.ytp-settings-button').click();
				Array.prototype.forEach.call(element.querySelectorAll('#ytp-main-menu-id .ytp-menuitem[aria-checked="true"]'), button => button.click());
				element.querySelector('.ytp-settings-button').click();
			}

			// remove title overlay of external player
			const title = element.querySelector('.ytp-chrome-top');
			title && title.remove() === element.querySelector('.ytp-gradient-top').remove();
		}
	}

	enableAnimatedThumbs() {
		this.main.addDomListener(window, 'mouseover', ({ target: image, }) => {
			if (image.nodeName !== 'IMG') { return; }
			const videoId = getVideoIdFromImageSrc(image);
			if (!videoId) { return; }
			let original = image.src;
			let index = 0;

			(function loop() {
				if (!original) { return; }
				index = index % 3 + 1;
				image.src = `https://i.ytimg.com/vi/${ videoId }/${ index }.jpg`;
				setTimeout(loop, 1000);
			})();

			once(image, 'mouseout', event => {
				image.src = original;
				original = null;
			});
		});
	}

	enableFullscreen() {
		const { options, } = this.main;
		this.main.addStyleLink(chrome.extension.getURL('web/layout.css'));

		options.player.seamlessFullscreen.atStart && document.documentElement.classList.add('fullscreen');

		this.main.addDomListener(window, 'wheel', event => {
			if (
				!document.documentElement.classList.contains('watchpage')
				|| !options.player.seamlessFullscreen
				|| event.ctrlKey || event.altKey || event.shiftKey
			) { return; }
			if (
				event.deltaY <= 0 && window.pageYOffset === 0
				&& event.target && event.target.matches
				&& !event.target.matches('#playlist-autoscroll-list *')
			) { // scroll to top
				options.player.seamlessFullscreen.showOnScrollTop
				&& document.documentElement.classList.add('fullscreen');
			} else if (
				options.player.seamlessFullscreen.hideOnScrollDown
				&& document.documentElement.classList.contains('fullscreen')
			) {
				document.documentElement.classList.remove('fullscreen');
				window.scrollY === 0 && event.preventDefault();
			}
		});

		options.player.seamlessFullscreen && options.player.seamlessFullscreen.showOnMouseRight
		&& this.main.addDomListener(window, 'mousemove', event => {
			options.player.seamlessFullscreen && event.pageX < (options.player.seamlessFullscreen.showOnMouseRight || 0)
			&& document.documentElement.classList.contains('watchpage')
			&& document.documentElement.classList.add('fullscreen');
		});
	}

	enableVideoZoom() {
		this.main.addDomListener(window, 'wheel', event => {
			if (
				!event.ctrlKey || !event.deltaY
				|| !event.target.matches('#player-api, #player-api *')
			) { return; }
			event.preventDefault();
			const factor = 1 + this.options.player.zoomFactor / 100;
			const divisor = 1 / factor;
			const rect = document.querySelector('#player-api').getBoundingClientRect();
			this.setZoom(
				event.deltaY < 0 ? (this.scale * factor) : (this.scale / factor),
				((event.clientX - rect.left) / rect.width) * (1 - divisor) + this.scaleX * divisor,
				((event.clientY - rect.top) / rect.height) * (1 - divisor) + this.scaleY * divisor
			);
		});
	}

	enableVideoAutoZoom() {
		const canvas = this.canvas = document.createElement('canvas');
		const ignore = 0.2;
		const probes = [ 0.05, 0.5, 0.95, ];
		this.main.actions.setAction('videoAutoZoom', () => {
			const video = this.main.player.video;
			const ctx = canvas.getContext('2d');
			const width = canvas.width = video.videoWidth * (1 - ignore * 2) << 0;
			const height = canvas.height = video.videoHeight;
			ctx.drawImage(
				video,
				ignore, 0, width, height,
				0, 0, width, height
			);

			const tRow = ctx.getImageData(0, 2, width, 1).data;
			const bRow = ctx.getImageData(0, height - 3, width, 1).data;
			let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
			for (let x = 0, w4 = width * 4; x < w4; x += 4) {
				c0 += tRow[x + 0] + bRow[x + 0];
				c1 += tRow[x + 1] + bRow[x + 1];
				c2 += tRow[x + 2] + bRow[x + 2];
				c3 += tRow[x + 3] + bRow[x + 3];
			}
			c0 = c0 / width / 2 << 0; c1 = c1 / width / 2 << 0; c2 = c2 / width / 2 << 0; c3 = c3 / width / 2 << 0;
			const cu0 = c0 + 5, cu1 = c1 + 5, cu2 = c2 + 5, cu3 = c3 + 5;
			const cl0 = c0 - 5, cl1 = c1 - 5, cl2 = c2 - 5, cl3 = c3 - 5;

			const margins = probes.map(probe => {
				const data = ctx.getImageData(width * probe << 0, 0, 1, height).data;
				console.log('data', ignore * video.videoWidth + width * probe << 0, data);
				const uBound = data.length / 3 << 0, lBound = data.length / 3 * 2 << 0;
				let upper = 0, lower = data.length;
				while (
					upper < uBound
					&& cu0 >= data[upper + 0] && cu1 >= data[upper + 1] && cu2 >= data[upper + 2] && cu3 >= data[upper + 3]
					&& cl0 <= data[upper + 0] && cl1 <= data[upper + 1] && cl2 <= data[upper + 2] && cl3 <= data[upper + 3]
				) { upper += 4; }
				while (
					lower > lBound
					&& cu0 >= data[lower - 4] && cu1 >= data[lower - 3] && cu2 >= data[lower - 2] && cu3 >= data[lower - 1]
					&& cl0 <= data[lower - 4] && cl1 <= data[lower - 3] && cl2 <= data[lower - 2] && cl3 <= data[lower - 1]
				) { lower -= 4; }
				return { top: upper / 4, bottom: (data.length - lower) / 4, };
			});

			let { top, bottom, } = margins.reduce((a, b) => ({ top: a.top > b.top ? a.top : b.top, bottom: a.bottom > b.bottom ? a.bottom : b.bottom, }));
			top < 4 && (top = 0); bottom < 4 && (bottom = 0);
			this.setZoom(1 / (1 - (top + bottom) / height), 0.5, (top - bottom) / 2 / height + 0.5);
		});
	}

	setZoom(scale = 1, x = 0.5, y = 0.5) {
		this.zoom.textContent = (`
			#player-api .html5-video-container video
			{
				transform: scale(${ (this.scale = scale).toFixed(6) }) !important;
				transform-origin: ${ ((this.scaleX = x) * 100).toFixed(6) }% ${ ((this.scaleY = y) * 100).toFixed(6) }% !important;
			}
		`);
	}
};

});
