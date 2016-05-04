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

const CSS = ({ likesColor = '#0b2', dislikesColor = '#C00', barHeight = 2, } = { }) => (`
.video-time /* make room for ratings bar */
{ margin-bottom: ${ barHeight }px !important; }
.yt-uix-simple-thumb-related>img /* without this, the ratings bar will be hidden far below the sidebar images */
{ margin-bottom: -27px !important; }
.channels-browse-content-grid .channels-content-item
{ height: 167px; }
.inserted-ratings
{ position: relative; }
.videowall-endscreen .inserted-ratings
{ top: -${ barHeight }px !important; }
.inserted-ratings>*
{ height: ${ barHeight }px !important; }
.inserted-ratings .video-extras-sparkbar-likes
{ background-color: ${ likesColor } !important; }
.inserted-ratings .video-extras-sparkbar-dislikes
{ background-color: ${ dislikesColor } !important; }
.ytp-redesign-videowall-still-info
{ display: block; height: 100%; }
`);

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

return function(main) {
	main.once('observerCreated', () => {
		const { options, observer,  addStyle, port, } = main;
		if (!options.displayRatings) { return; }
		const style = addStyle(CSS(options.displayRatings));

		const loadAndDisplayRating = (element, id) => spawn(function*() {
			if (element.dataset.rating) { return; }
			element.dataset.rating = true;
			if (options.displayRatings.totalLifetime < 0) {
				return attatchRatingBar(element, (yield loadRatingFromServer(id)));
			}
			const stored = (yield port.request('db', 'get', id, [ 'meta', 'rating', ]));
			let now = Date.now(), age;
			if (
				stored.meta && stored.rating
				&& (age = now - stored.rating.timestamp) < options.displayRatings.totalLifetime
				&& age < (now - stored.meta.published) * (options.displayRatings.relativeLifetime / 100)
			) {
				return attatchRatingBar(element, stored);
			}
			const loaded = (yield loadRatingFromServer(id));
			attatchRatingBar(element, loaded);
			return Promise.all([
				port.request('db', 'set', id, { rating: loaded.rating, }),
				port.request('db', 'assign', id, 'meta', loaded.meta),
			]);
		})
		.catch(error => console.error(error) === delete element.dataset.rating);

		observer.all('img:not([data-rating="true"]), .videowall-still-image:not([data-rating="true"]), .ytp-redesign-videowall-still-image:not([data-rating="true"])', (element) => {
			const videoId = getVideoIdFromImageSrc(element);
			videoId && loadAndDisplayRating(element, videoId);
		});

		const obs = new MutationObserver(mutations => mutations.forEach(({ target: element, }) => {
			obs.takeRecords();
			if (element.dataset.rating || !element.matches || !element.matches('img, .videowall-still-image, .ytp-redesign-videowall-still-image')) { return; }
			const videoId = getVideoIdFromImageSrc(element);
			videoId && loadAndDisplayRating(element, videoId);
		}));
		obs.observe(document, { subtree: true, attributes: true, attributeFilter: [ 'src', 'style', ], });

		main.once(Symbol.for('destroyed'), () => {
			obs.disconnect();
			Array.prototype.forEach.call(document.querySelectorAll('[data-rating="true"]'), element => delete element.dataset.rating);
			Array.prototype.forEach.call(document.querySelectorAll('.inserted-ratings'), element => element.remove());
		});
	});
};

});
