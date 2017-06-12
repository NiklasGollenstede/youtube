(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/version': { gecko, edgeHTML, },
	utils: { getVideoIdFromImageSrc, },
	Templates,
}) => { /* global window, document, MutationObserver, */

const CSS = {
	static: () => (`/* template strings confuse the syntax highlighting in Chrome and Firefox */
		.inserted-ratings
		{ position: relative; }
		.inserted-ratings>*
		{ float: left; }
		.videowall-endscreen .inserted-ratings
		{ bottom: 0 !important; position: absolute !important; width: 100% !important; }
	`),
	barHeight: barHeight => ((barHeight /= global.devicePixelRatio), `
		.video-time /* make room for ratings bar */
		{ margin-bottom: `+( barHeight )+`px !important; }
		.inserted-ratings>*
		{ height: `+( barHeight )+`px !important; }
		.related-list-item .inserted-ratings
		{ bottom: `+( barHeight + 3.5 + gecko * 0.5 - edgeHTML * 0.23 )+`px !important; }
		.related-list-item .yt-pl-thumb  .inserted-ratings
		{ bottom: `+( barHeight + 0.5 /* + gecko * 0.5 ? */ )+`px !important; }
	`),
	likesColor: likesColor => (`
		.inserted-ratings .video-extras-sparkbar-likes
		{ background-color: `+( likesColor )+` !important; }
	`),
	dislikesColor: dislikesColor => (`
		.inserted-ratings .video-extras-sparkbar-dislikes
		{ background-color: `+( dislikesColor )+` !important; }
	`),
};

return class Ratings {
	constructor(main) {
		this.main = main;
		this.observer = null;
		this.selector = 'img, .ytp-videowall-still-image, div#image';
		this.barParentSelector = '.video-thumb, .ytp-videowall-still-image';
		this.tooltipSelector = '.yt-thumb, .yt-pl-thumb, .ytp-videowall-still';

		this.enable = this.enable.bind(this);
		this.disable = this.disable.bind(this);
		this.loadAndDisplayRating = this.loadAndDisplayRating.bind(this);

		main.once(Symbol.for('destroyed'), this.disable);

		main.once('observerCreated', () => {
			const ratingOptions = main.options.displayRatings.children;
			main.setStyle('ratings-static', CSS.static());
			[ 'barHeight', 'likesColor', 'dislikesColor', ].forEach(
				option => ratingOptions[option].whenChange(value => main.setStyle('ratings-'+ option, CSS[option](value)))
			);
			main.options.displayRatings.when({
				true: this.enable,
				false: this.disable,
			});
		});

		main.addDomListener(window, 'click', () => Array.prototype.forEach.call(document.querySelectorAll('.yt-uix-tooltip-tip'), item => item.remove()));
	}

	async loadAndDisplayRating(element) {
		const id = getVideoIdFromImageSrc(element);
		if (!id || element.dataset.rating) { return; }
		element.dataset.rating = true;
		try {
			this.attatchRatingBar(element, (await this.main.port.request('VideoInfo.subscribe', id, data => console.warn('got update', id, data))));
		} catch (error) {
			console.error(error);
			delete element.dataset.rating;
		}
	}

	attatchRatingBar(image, { rating, views, published, duration, viewed, })  {
		const container = image.closest(this.barParentSelector) || image.parentNode;
		// element.matches('ytg-thumbnail') && (element = element.parentNode.parentNode.parentNode);
		container.insertAdjacentHTML('beforeend', Templates.ratingsBar(rating));
		const tooltiped = (image.closest(this.tooltipSelector) || image.parentNode);
		tooltiped.classList.add('yt-uix-tooltip');
		tooltiped.title = Templates.videoInfoTitle(rating, views, published, viewed, duration);
	}

	enable() {
		this.main.observer.all(this.selector.split(',').map(s => s +':not([data-rating="true"])').join(','), this.loadAndDisplayRating);

		const observer = this.observer = new MutationObserver(mutations => mutations.forEach(({ target: element, }) => {
			observer.takeRecords();
			if (element.dataset.rating || !element.matches || !element.matches(this.selector)) { return; }
			this.loadAndDisplayRating(element);
		}));
		observer.observe(document, { subtree: true, attributes: true, attributeFilter: [ 'src', 'style', ], });
	}

	disable() {
		this.observer && this.observer.disconnect();
		try { this.main.observer && this.main.observer.remove(this.selector.split(',').map(s => s +':not([data-rating="true"])').join(','), this.loadAndDisplayRating); } catch (_) { }
		Array.prototype.forEach.call(document.querySelectorAll('[data-rating="true"]'), element => delete element.dataset.rating);
		Array.prototype.forEach.call(document.querySelectorAll('.inserted-ratings'), element => {
			const image = element.querySelector(this.selector) || element;
			const tooltiped = image.closest(this.tooltipSelector) || image.parentNode;
			tooltiped.classList.remove('yt-uix-tooltip');
			tooltiped.removeAttribute('title');
			delete tooltiped.dataset.tooltipText;
			element.remove();
		});
	}
};

}); })(this);
