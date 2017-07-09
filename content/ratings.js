(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/version': { gecko, edgeHTML, },
	'node_modules/web-ext-utils/loader/content': { onUnload, connect, },
	dom,
	observer: Inserts,
	options,
	Templates,
	utils: { getVideoIdFromImageSrc, },
}) => { /* global window, document, MutationObserver, */

const VideoInfo = (await connect('VideoInfo'));
let Changes = null;

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

const selector = 'img, .ytp-videowall-still-image, div#image';
const barParentSelector = '.video-thumb, .ytp-videowall-still-image';
const tooltipSelector = '.yt-thumb, .yt-pl-thumb, .ytp-videowall-still';


const ratingOptions = options.displayRatings.children;
dom.setStyle('ratings-static', CSS.static());
[ 'barHeight', 'likesColor', 'dislikesColor', ].forEach(
	option => ratingOptions[option].whenChange(value => dom.setStyle('ratings-'+ option, CSS[option](value)))
);
options.displayRatings.when({
	true: enable,
	false: disable,
});
onUnload.addListener(disable);

dom.on(window, 'click', () => document.querySelectorAll('.yt-uix-tooltip-tip').forEach(item => item.remove()));

async function loadAndDisplayRating(element) {
	const id = getVideoIdFromImageSrc(element);
	if (!id || element.dataset.rating) { return; }
	element.dataset.rating = true;
	try {
		const callback = data => console.warn('got update', id, data);
		VideoInfo.afterEnded('unsubscribe', id, callback);
		attatchRatingBar(element, (await VideoInfo.request('subscribe', id, callback, [ 'rating', 'views', 'published', 'duration', 'viewed', ])));
	} catch (error) {
		console.error(error);
		delete element.dataset.rating;
	}
}

function attatchRatingBar(image, { rating, views, published, duration, viewed, })  {
	const container = image.closest(barParentSelector) || image.parentNode;
	// element.matches('ytg-thumbnail') && (element = element.parentNode.parentNode.parentNode);
	container.insertAdjacentHTML('beforeend', Templates.ratingsBar(rating));
	const tooltiped = (image.closest(tooltipSelector) || image.parentNode);
	tooltiped.classList.add('yt-uix-tooltip');
	tooltiped.title = Templates.videoInfoTitle(rating, views, published, viewed, duration);
}

function enable() {
	if (Changes) { return; }
	Inserts.all(selector.split(',').map(s => s +':not([data-rating="true"])').join(','), loadAndDisplayRating);

	Changes = new MutationObserver(mutations => mutations.forEach(({ target: element, }) => {
		if (element.dataset.rating || !element.matches || !element.matches(selector)) { return; }
		loadAndDisplayRating(element);
	}));
	Changes.observe(document, { subtree: true, attributes: true, attributeFilter: [ 'src', 'style', ], });
}

function disable() {
	if (!Changes) { return; }
	Changes.disconnect();
	try { Inserts.remove(selector.split(',').map(s => s +':not([data-rating="true"])').join(','), loadAndDisplayRating); } catch (_) { }
	cleanup();
}

function cleanup() {
	document.querySelectorAll('[data-rating="true"]').forEach(element => delete element.dataset.rating);
	document.querySelectorAll('.inserted-ratings').forEach(element => {
		const image = element.querySelector(selector) || element;
		const tooltiped = image.closest(tooltipSelector) || image.parentNode;
		tooltiped.classList.remove('yt-uix-tooltip');
		tooltiped.removeAttribute('title');
		delete tooltiped.dataset.tooltipText;
		element.remove();
	});
}
cleanup(); // Firefox + content unload => -.-

}); })(this);
