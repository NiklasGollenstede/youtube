'use strict'; define('content/ratings', [
	'content/utils', 'content/templates', 'es6lib', 'es6lib/template/escape',
], function(
	{ getVideoIdFromImageSrc, },
	Templates,
	{
		concurrent: { async, spawn, },
		dom: { once, },
		network: { HttpRequest, },
	},
	{ decodeHtml, }
) {

const CSS = {
	static: () => (`
		.inserted-ratings
		{ position: relative; }
		.inserted-ratings>*
		{ float: left; }
		.videowall-endscreen .inserted-ratings
		{ bottom: 0 !important; position: absolute !important; width: 100% !important; }
	`),
	barHeight: barHeight => (`
		.video-time /* make room for ratings bar */
		{ margin-bottom: ${ barHeight }px !important; }
		.inserted-ratings>*
		{ height: ${ barHeight }px !important; }
		.related-list-item .inserted-ratings
		{ bottom: ${ 3.5 + barHeight }px !important; }
		.related-list-item .yt-pl-thumb  .inserted-ratings
		{ bottom: ${ 0.5 + barHeight }px !important; }
	`),
	likesColor: likesColor => (`
		.inserted-ratings .video-extras-sparkbar-likes
		{ background-color: ${ likesColor } !important; }
	`),
	dislikesColor: dislikesColor => (`
		.inserted-ratings .video-extras-sparkbar-dislikes
		{ background-color: ${ dislikesColor } !important; }
	`),
};

const getInt = (string, regexp) => parseInt((string.match(regexp) || [0,'0'])[1].replace(/[\,\.]*/g, ''), 10);
const getString = (string, regexp) => decodeHtml((string.match(regexp) || [0,''])[1]);
const getTime = (string, regexp) => +new Date((string.match(regexp) || [0,''])[1]);

const loadRatingFromServer = id => HttpRequest('https://www.youtube.com/watch?v='+ id).then(({ response, }) => ({
	id,
	rating: {
		timestamp: +Date.now(),
		likes: getInt(response, (/<[^\/>]*?class="[^"]*?like-button-renderer-like-button[^"]*?"[^\/>]*?><span [^\/>]*?>([\d\.\,]+)<\//)),
		dislikes: getInt(response, (/<[^\/>]*?class="[^"]*?like-button-renderer-dislike-button[^"]*?"[^\/>]*?><span [^\/>]*?>([\d\.\,]+)<\//)),
		views: getInt(response, (/<meta[^\/>]*?itemprop="interactionCount"[^\/>]*?content="([\d\.\,]+)">/)),
	},
	meta: {
		title: getString(response, (/<meta[^\/>]*?name="title"[^\/>]*?content="([^"]*?)">/)),
		published: getTime(response, (/<meta[^\/>]*?itemprop="datePublished"[^\/>]*?content="([^"]*?)">/)),
	},
}));

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
			const styles = this.styles = { static: main.addStyle(CSS.static()), };
			[ 'barHeight', 'likesColor', 'dislikesColor' ].forEach(option => {
				styles[option] = main.addStyle('');
				ratingOptions[option].whenChange(value => styles[option].textContent = CSS[option](value));
			});
			[ 'totalLifetime', 'relativeLifetime', ].forEach(option => ratingOptions[option].whenChange(value => this[option] = value));
			main.options.displayRatings.when({
				true: this.enable,
				false: this.disable,
			});
		});

		main.addDomListener(window, 'click', () => Array.prototype.forEach.call(document.querySelectorAll('.yt-uix-tooltip-tip'), item => item.remove()));
	}
// 		viewsRelative: tab => db.get(tab.videoId, [ 'viewed', 'meta', ]).then(({ viewed, meta, }) => -(viewed || 0) / (meta && meta.duration || Infinity)),
	loadAndDisplayRating(element) {
		const id = getVideoIdFromImageSrc(element);
		if (!id || element.dataset.rating) { return; }
		element.dataset.rating = true;
		const { port, } = this.main;
		spawn(function*() {
			if (this.totalLifetime < 0) {
				return this.attatchRatingBar(element, (yield loadRatingFromServer(id)));
			}
			const stored = (yield port.request('db', 'get', id, [ 'meta', 'rating', 'viewed', ]));
			let now = Date.now(), age;
			if (
				stored.meta && stored.rating
				&& (age = now - stored.rating.timestamp) < this.totalLifetime * 36e5
				&& age < (now - stored.meta.published) * (this.relativeLifetime / 100)
			) {
				return this.attatchRatingBar(element, stored);
			}
			const loaded = (yield loadRatingFromServer(id));
			this.attatchRatingBar(element, Object.assign(stored, loaded));
			return Promise.all([
				port.request('db', 'set', id, { rating: loaded.rating, }),
				port.request('db', 'assign', id, 'meta', loaded.meta),
			]);
		}, this)
		.catch(error => console.error(error) === delete element.dataset.rating);
	}

	attatchRatingBar(image, { rating: { likes, dislikes, views, }, meta: { published, duration, }, viewed, })  {
		const container = image.closest(this.barParentSelector) || image.parentNode;
		// element.matches('ytg-thumbnail') && (element = element.parentNode.parentNode.parentNode);
		container.insertAdjacentHTML('beforeend', Templates.ratingsBar(likes, dislikes));
		const tooltiped = (image.closest(this.tooltipSelector) || image.parentNode);
		tooltiped.classList.add('yt-uix-tooltip');
		tooltiped.title = Templates.videoInfoTitle(likes, dislikes, views, published, viewed, duration);
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
		this.main.observer && this.main.observer.remove(this.selector.split(',').map(s => s +':not([data-rating="true"])').join(','), this.loadAndDisplayRating);
		Array.prototype.forEach.call(document.querySelectorAll('[data-rating="true"]'), element => delete element.dataset.rating);
		Array.prototype.forEach.call(document.querySelectorAll('.inserted-ratings'), element => {
			const image = element.querySelector(this.selector) || element;
			const tooltiped = image.closest(this.tooltipSelector);
			tooltiped.classList.remove('yt-uix-tooltip');
			tooltiped.removeAttribute('title');
			delete tooltiped.dataset.tooltipText;
			element.remove();
		});
	}
};

});
