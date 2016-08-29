(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	require,
	'node_modules/web-ext-utils/chrome/': { extension, },
	'node_modules/es6lib/dom': { createElement, once, getParent, },
	utils: { getVideoIdFromImageSrc, },
}) {

const noop = document.createElement('p');

return class Layout {
	constructor(main) {
		this.main = main;
		this.options = null;

		const parents              = `img, .ytp-videowall-still,       .ytp-redesign-videowall-still,       .videowall-still,      .thumbnail-container`.split(/,\s+/);
		this.animateThumbsTargets  = `img, .ytp-videowall-still-image, .ytp-redesign-videowall-still-image, .videowall-still-image, div#image`;
		this.animateThumbsParents  = parents.join(', ');
		this.animateThumbsChildren = parents.map(s => s +' *, '+ s).join(', ');
		this.animateThumbsScaleIf  = `.yt-uix-simple-thumb-related *`;
		this.main.setStyle('thumb-zoom', `
			.yt-uix-simple-thumb-related     .animated-thumb { transform: scaleY(1.366); } /* view, */
			.yt-thumb-simple                 .animated-thumb { transform: scaleY(1.366) translateY(+0.17%); } /* home, */
			.yt-thumb-clip                   .animated-thumb { transform: scaleY(1.016) translateY(-0.22%); } /* channels, */
		`);

		this.scale = 1;
		this.scaleX = this.scaleY = 0.5;
		this.zoom = createElement('style');
		main.player.on('loaded', (element) => element.ownerDocument.head.appendChild(this.zoom));

		this.disableAnnotations = this.disableAnnotations.bind(this);
		this.animatedThumbsOnMouseover = this.animatedThumbsOnMouseover.bind(this);
		this.fullscreenOnWheel = this.fullscreenOnWheel.bind(this);
		this.seamlessFullscreenOnMousemove = this.seamlessFullscreenOnMousemove.bind(this);
		this.videoZoomOnWheel = this.videoZoomOnWheel.bind(this);

		main.once('optionsLoaded', this.optionsLoaded.bind(this));

		main.on('navigated', this.navigated.bind(this));

		main.once(Symbol.for('destroyed'), () => {
			this.zoom.remove();
			document.documentElement.classList.remove('watchpage');
			document.documentElement.classList.remove('playlist');
		});
	}

	optionsLoaded(options) {
		this.options = options;
		options.player.children.annotations.when({
			false: () => this.main.player.on ('playing', this.disableAnnotations),
			true:  () => this.main.player.off('playing', this.disableAnnotations),
		});
		options.animateThumbs.when({
			true:  () => this.main.addDomListener   (window, 'mouseover', this.animatedThumbsOnMouseover),
			false: () => this.main.removeDomListener(window, 'mouseover', this.animatedThumbsOnMouseover),
		});
		options.player.children.seamlessFullscreen.when({
			true: () => {
				this.main.setStyle('layout-main', require(this.main.redesign ? './layout-new.css' : './layout-old.css'));
				this.main.addDomListener(window, 'wheel', this.fullscreenOnWheel);
			},
			false: () => {
				this.main.setStyle('layout-main', '');
				this.main.removeDomListener(window, 'wheel', this.fullscreenOnWheel);
			},
		});
		options.comments.when({
			true:  () => this.main.setStyle('show-comments', ''),
			false:  () => this.main.setStyle('show-comments', `.watchpage #watch-discussion { display: none !important; }`),
		});
		options.player.children.seamlessFullscreen.children.showOnMouseRight.when({
			true:  () => this.main.addDomListener   (window, 'mousemove', this.seamlessFullscreenOnMousemove),
			false: () => this.main.removeDomListener(window, 'mousemove', this.seamlessFullscreenOnMousemove),
		});
		options.player.children.zoomFactor.when({
			true:  () => this.main.addDomListener   (window, 'wheel', this.videoZoomOnWheel),
			false: () => this.main.removeDomListener(window, 'wheel', this.videoZoomOnWheel),
		});
		this.enableVideoAutoZoom();
	}

	navigated() {
		const { options, videoId, listId, player, } = this.main;
		if (!videoId || location.host !== 'www.youtube.com') {
			return document.documentElement.classList.remove('watchpage');
		}

		// add watchpage, playlist and fullscreen css hints
		document.documentElement.classList.add('watchpage');
		document.documentElement.classList[listId ? 'add' : 'remove']('playlist');
		document.documentElement.classList[options.player.children.seamlessFullscreen.children.atStart.value ? 'add' : 'remove']('fullscreen');

		player.loaded.then(element => {
			// use cinema mode to make progress-bar a bit larger
			options.player.children.cinemaMode.value && (element.querySelector('.ytp-size-button') || noop).click();

			// always display volume
			options.player.children.alwaysVolume.value && ((element.querySelector('.ytp-volume-panel') || noop).style.minWidth = '52px');

			// remove title overlay of external player
			const title = element.querySelector('.ytp-chrome-top');
			title && title.remove() === element.querySelector('.ytp-gradient-top').remove();

			// remove "Recommended for you" stuff
			if (options.hideRecommended.value) {
				Array.prototype.forEach.call(document.querySelectorAll('.related-list-item'), item => {
					const viewCount = item.querySelector('.view-count');
					viewCount && !(/\d/).test(viewCount.textContent) && item.remove();
				});
				player.once('ended', () => Array.prototype.forEach.call(document.querySelectorAll('a.ytp-videowall-still'), item => {
					const match = (/v=([\w-]{11})/).exec(item.href);
					match && !document.querySelector(`.related-list-item a[href$="${ match[1] }"]`) && (item.style.opacity = 0.3); // item.remove();
				}));
			}
		});
	}

	/// disables annotations (and all other checkboxes in the player settings)
	disableAnnotations() {
		const element = this.main.player.root;
		element.querySelector('.ytp-settings-button').click();
		Array.prototype.forEach.call(element.querySelectorAll('.ytp-settings-menu .ytp-menuitem[aria-checked="true"]'), _=>_.click());
		element.querySelector('.ytp-settings-button').click();
	}

	animatedThumbsOnMouseover({ target, }) {
		if (!target.matches || !target.matches(this.animateThumbsChildren)) { return; }

		const image = (target.closest(this.animateThumbsParents) || target).querySelector(this.animateThumbsTargets) || target;
		const videoId = getVideoIdFromImageSrc(image);
		if (!videoId) { return; }
		const background = !image.src;
		let original = background ? image.style.backgroundImage : image.src;
		let index = 0;
		image.classList.add('animated-thumb');

		(function loop() {
			if (!original) { return; }
			index = index % 3 + 1;
			background
			? image.style.backgroundImage = `url("https://i.ytimg.com/vi/${ videoId }/${ index }.jpg")`
			: image.src = `https://i.ytimg.com/vi/${ videoId }/${ index }.jpg`;
			setTimeout(loop, 1000);
		})();

		once(target, 'mouseout', event => {
			background ? image.style.backgroundImage = original : image.src = original;
			image.classList.remove('animated-thumb');
			original = null;
		});
	}

	fullscreenOnWheel(event) {
		if (
			!document.documentElement.classList.contains('watchpage')
			|| !this.options.player.children.seamlessFullscreen.value
			|| event.ctrlKey || event.altKey || event.shiftKey
		) { return; }
		if (
			event.deltaY <= 0 && (this.main.redesign ? document.querySelector('#top').scrollTop === 0 : window.pageYOffset === 0)
			&& event.target && event.target.matches
			&& !event.target.matches('#playlist-autoscroll-list *')
		) { // scroll to top
			this.options.player.children.seamlessFullscreen.children.showOnScrollTop.value
			&& document.documentElement.classList.add('fullscreen');
		} else if (
			this.options.player.children.seamlessFullscreen.children.hideOnScrollDown.value
			&& document.documentElement.classList.contains('fullscreen')
		) {
			document.documentElement.classList.remove('fullscreen');
			window.scrollY === 0 && event.preventDefault();
		}
	}

	seamlessFullscreenOnMousemove(event) {
		event.pageX < (this.options.player.children.seamlessFullscreen.children.showOnMouseRight.value || 0)
		&& document.documentElement.classList.contains('watchpage')
		&& document.documentElement.classList.add('fullscreen');
	}

	videoZoomOnWheel(event) {
		if (
			!event.ctrlKey || !event.deltaY
			|| !event.target.matches('.html5-video-player, .html5-video-player *, #external_player')
		) { return; }
		event.preventDefault();
		const factor = 1 + this.options.player.children.zoomFactor.value / 100;
		const divisor = 1 / factor;
		const rect = getParent(event.target, '.html5-video-player, #external_player').getBoundingClientRect();
		const scale = event.deltaY < 0 ? (this.scale * factor) : (this.scale / factor);
		this.setZoom(
			(scale < factor && scale > 1 / factor) || (scale > factor && scale < 1 / factor) ? 1 : scale,
			((event.clientX - rect.left) / rect.width) * (1 - divisor) + this.scaleX * divisor,
			((event.clientY - rect.top) / rect.height) * (1 - divisor) + this.scaleY * divisor
		);
	}

	enableVideoAutoZoom() {
		const canvas = this.canvas = document.createElement('canvas');
		const ignore = 0.2;
		const probes = [ 0.05, 0.5, 0.95, ];
		this.main.actions.setAction('videoAutoZoom', () => {
			const tol = 20;
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
			const cu0 = c0 + tol, cu1 = c1 + tol, cu2 = c2 + tol, cu3 = c3 + tol;
			const cl0 = c0 - tol, cl1 = c1 - tol, cl2 = c2 - tol, cl3 = c3 - tol;

			const margins = probes.map(probe => {
				const data = ctx.getImageData(width * probe << 0, 0, 1, height).data;
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

			let { top, bottom, } = margins.reduce((a, b) => ({ top: a.top < b.top ? a.top : b.top, bottom: a.bottom < b.bottom ? a.bottom : b.bottom, }));
			top < 4 && (top = 0); bottom < 4 && (bottom = 0);
			this.setZoom(1 / (1 - (top + bottom) / height), 0.5, (top - bottom) / 2 / height + 0.5);
		});
	}

	setZoom(scale = 1, x = 0.5, y = 0.5) {
		this.scale = scale; this.scaleX = x; this.scaleY = y;
		this.zoom.textContent = (`
			.html5-video-player video
			{
				transform: scale(${ this.scale.toFixed(6) }) !important;
				transform-origin: ${ (this.scaleX * 100).toFixed(6) }% ${ (this.scaleY * 100).toFixed(6) }% !important;
			}
		`);
	}
};

}); })();
