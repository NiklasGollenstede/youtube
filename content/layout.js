(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'./layout-new.css': newCss,
	'./layout-old.css': oldCss,
	utils: { getVideoIdFromImageSrc, },
}) => { /* global document, window, location, setTimeout, */

const noop = document.createElement('p');

return class Layout {
	constructor(main) {
		this.main = main;
		this.options = null;

		const parents              = `img, .ytp-videowall-still,       .ytp-redesign-videowall-still,       .videowall-still,      .thumbnail-container`.split(/,\s+/);
		this.animateThumbsTargets  = `img, .ytp-videowall-still-image, .ytp-redesign-videowall-still-image, .videowall-still-image, div#image`;
		this.animateThumbsParents  = parents.join(', ');
		this.animateThumbsChildren = parents.map(s => s +' *, '+ s).join(', ');
		this.main.setStyle('thumb-zoom', `
			.yt-uix-simple-thumb-related     .animated-thumb:not(.loading) { transform: scaleY(1.366); } /* view, */
			.yt-thumb-simple                 .animated-thumb:not(.loading) { transform: scaleY(1.366) translateY(+0.17%); } /* home, */
			.yt-thumb-clip                   .animated-thumb:not(.loading) { transform: scaleY(1.016) translateY(-0.22%); } /* channels, */
		`);

		this.disableAnnotations = this.disableAnnotations.bind(this);
		this.animatedThumbsOnMouseover = this.animatedThumbsOnMouseover.bind(this);
		this.fullscreenOnWheel = this.fullscreenOnWheel.bind(this);
		this.fullscreenOnMousemove = this.fullscreenOnMousemove.bind(this);

		main.once('optionsLoaded', this.optionsLoaded.bind(this));

		main.on('navigated', this.navigated.bind(this));

		main.once(Symbol.for('destroyed'), () => {
			document.documentElement.classList.remove('watchpage');
			document.documentElement.classList.remove('playlist');
		});
	}

	optionsLoaded(options) {
		this.options = options;
		options.player.children.annotations.when({
			false: () => {
				this.main.setStyle('annotations', `.ytp-ce-element { display: none; }`);
				this.main.player.on('playing', this.disableAnnotations);
			},
			true: () => {
				this.main.setStyle('annotations', ``);
				this.main.player.off('playing', this.disableAnnotations);
			},
		});
		options.animateThumbs.when({
			true:  () => this.main.addDomListener   (window, 'mouseover', this.animatedThumbsOnMouseover),
			false: () => this.main.removeDomListener(window, 'mouseover', this.animatedThumbsOnMouseover),
		});
		options.player.children.seamlessFullscreen.when({
			true: () => {
				this.main.setStyle('layout-main', this.main.redesign ? newCss : oldCss);
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
			true:  () => this.main.addDomListener   (window, 'mousemove', this.fullscreenOnMousemove),
			false: () => this.main.removeDomListener(window, 'mousemove', this.fullscreenOnMousemove),
		});
	}

	navigated() {
		const { options, videoId, listId, player, } = this.main;
		if (!videoId || location.host !== 'www.youtube.com') {
			return void document.documentElement.classList.remove('watchpage');
		}

		// add watchpage, playlist and fullscreen css hints
		document.documentElement.classList.add('watchpage');
		document.documentElement.classList[listId ? 'add' : 'remove']('playlist');
		document.documentElement.classList[options.player.children.seamlessFullscreen.children.atStart.value ? 'add' : 'remove']('fullscreen');

		player.promise('loaded', 'unloaded').then(element => {
			// use cinema mode to make progress-bar a bit larger
			options.player.children.cinemaMode.value && (element.querySelector('.ytp-size-button') || noop).click();

			// always display volume
			options.player.children.alwaysVolume.value && ((element.querySelector('.ytp-volume-panel') || noop).style.minWidth = '52px');

			// remove title overlay of external player
			const title = element.querySelector('.ytp-chrome-top');
			if (title) { title.remove(); element.querySelector('.ytp-gradient-top').remove(); }

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
			if (background) {
				image.style.backgroundImage = `url("https://i.ytimg.com/vi/${ videoId }/${ index }.jpg")`;
			} else {
				image.classList.add('loading');
				image.addEventListener('load', () => image.classList.remove('loading'), { once: true, });
				image.src = `https://i.ytimg.com/vi/${ videoId }/${ index }.jpg`;
			}
			setTimeout(loop, 1000);
		})();

		target.addEventListener('mouseout', event => {
			background ? image.style.backgroundImage = original : image.src = original;
			image.classList.remove('animated-thumb');
			original = null;
		}, { once: true, });
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

	fullscreenOnMousemove(event) {
		event.pageX < (this.options.player.children.seamlessFullscreen.children.showOnMouseRight.value || 0)
		&& document.documentElement.classList.contains('watchpage')
		&& document.documentElement.classList.add('fullscreen');
	}
};

}); })(this);
