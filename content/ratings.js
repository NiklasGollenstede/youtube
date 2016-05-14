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
		.yt-uix-simple-thumb-related>img /* without this, the ratings bar will be hidden far below the sidebar images */
		{ margin-bottom: -27px !important; }
		.channels-browse-content-grid .channels-content-item
		{ height: 167px; }
		.inserted-ratings
		{ position: relative; }
		.ytp-redesign-videowall-still-info
		{ display: block; height: 100%; }
	`),
	barHeight: barHeight => (`
		.video-time /* make room for ratings bar */
		{ margin-bottom: ${ barHeight }px !important; }
		.videowall-endscreen .inserted-ratings
		{ top: -${ barHeight }px !important; }
		.inserted-ratings>*
		{ height: ${ barHeight }px !important; }
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

function attatchRatingBar(element, { rating: { likes, dislikes, views, }, meta: { published, }, })  {
	if (element.matches('img, .videowall-still-image, .ytp-redesign-videowall-still-image')) {
		element = element.parentNode;
		if (element.matches('.yt-thumb-clip')) {
			element = element.parentNode.parentNode;
		}
	}
	element.classList.add('yt-uix-tooltip');
	element.insertAdjacentHTML('beforeend', Templates.ratingsBar(likes, dislikes));
	element.title = Templates.videoInfoTitle(likes, dislikes, views, published);
}

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
		this.selector = 'img, .videowall-still-image, .ytp-redesign-videowall-still-image';

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
	}

	loadAndDisplayRating(element) {
		const id = getVideoIdFromImageSrc(element);
		if (!id || element.dataset.rating) { return; }
		const { port, } = this.main;
		spawn(function*() {
			element.dataset.rating = true;
			if (this.totalLifetime < 0) {
				return attatchRatingBar(element, (yield loadRatingFromServer(id)));
			}
			const stored = (yield port.request('db', 'get', id, [ 'meta', 'rating', ]));
			let now = Date.now(), age;
			if (
				stored.meta && stored.rating
				&& (age = now - stored.rating.timestamp) < this.totalLifetime
				&& age < (now - stored.meta.published) * (this.relativeLifetime / 100)
			) {
				return attatchRatingBar(element, stored);
			}
			const loaded = (yield loadRatingFromServer(id));
			attatchRatingBar(element, loaded);
			return Promise.all([
				port.request('db', 'set', id, { rating: loaded.rating, }),
				port.request('db', 'assign', id, 'meta', loaded.meta),
			]);
		}, this)
		.catch(error => console.error(error) === delete element.dataset.rating);
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
		Array.prototype.forEach.call(document.querySelectorAll('.inserted-ratings'), element => element.remove());
	}
};

});
