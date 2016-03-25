'use strict'; define('content/ratings', [
	'content/utils', 'content/templates', 'es6lib',
], function(
	{ getVideoIdFromImageSrc, },
	Templates,
	{
		concurrent: { async, spawn, },
		dom: { once, },
		network: { HttpRequest, },
	}
) {

const CSS = ({ likesColor = '#0b2', dislikesColor = '#C00', } = { }) => (`
.video-time /* make room for ratings bar */
{
    margin-bottom: 2px;
}
.yt-uix-simple-thumb-related>img /* without this, the ratings bar will be hidden far below the sidebar images */
{
    margin-bottom: -27px !important;
}
.channels-browse-content-grid .channels-content-item
{
    height: 167px;
}
.inserted-ratings
{
    position: relative;
}
.videowall-endscreen .inserted-ratings
{
    top: -2px;
}
.inserted-ratings .video-extras-sparkbar-likes
{
    background-color: ${ likesColor } !important;
}
.inserted-ratings .video-extras-sparkbar-dislikes
{
    background-color: ${ dislikesColor } !important;
}
`);

function attatchRatingBar(element, { rating: { likes, dislikes, views, }, meta: { published, }, })  {
	if (element.matches('img, .videowall-still-image')) {
		element = element.parentNode;
		if (element.matches('.yt-thumb-clip')) {
			element = element.parentNode.parentNode;
		}
	}
	element.classList.add('yt-uix-tooltip');
	element.insertAdjacentHTML('beforeend', Templates.ratingsBar(likes, dislikes));
	element.title = Templates.videoInfoTitle(likes, dislikes, views, published);
}

const decoder = document.createElement('textarea');
const decodeHtml = html => (decoder.innerHTML = html) && decoder.value;
const getInt = (string, regexp) => parseInt((string.match(regexp) || [0,'0'])[1].replace(/[\,\.]*/g, ''), 10);
const getString = (string, regexp) => decodeHtml((string.match(regexp) || [0,''])[1]);
const getTime = (string, regexp) => +new Date((string.match(regexp) || [0,''])[1]);

const loadRatingFromServer = id => HttpRequest('https://www.youtube.com/watch?v='+ id).then(({ response, }) => ({
	id,
	rating: {
		timestamp: +Date.now(),
		likes: getInt(response, (/<[^\/>]*?class="[^"]*?like-button-renderer-like-button[^"]*?"[^\/>]*?><span [^\/>]*?>([\d\.\,]+)<\//)),
		dislikes: getInt(response, (/<[^\/>]*?class="[^"]*?like-button-renderer-dislike-button[^"]*?"[^\/>]*?><span [^\/>]*?>([\d\.\,]+)<\//)),
		views: getInt(response, (/<[^\/>]*?class="[^"]*?watch-view-count[^"]*?"[^\/>]*?>([\d\.\,]+)<\//)),
	},
	meta: {
		title: getString(response, (/<meta[^\/>]*?name="title"[^\/>]*?content="([^"]*?)">/)),
		published: getTime(response, (/<meta[^\/>]*?itemprop="datePublished"[^\/>]*?content="([^"]*?)">/)),
	},
}));

return function(main) {

	main.options.displayRatings
	&& main.once('observerCreated', ({ observer, addStyle, port, }) => {
		const style = addStyle(CSS({ }));

		const loadAndDisplayRating = (element, id) => spawn(function*() {
			element.dataset.rating = true;
			const stored = (yield port.request('get', id, [ 'meta', 'rating', ]));
			if (stored.meta && stored.rating) {
				return attatchRatingBar(element, stored);
			}
			const loaded = (yield loadRatingFromServer(id));
			attatchRatingBar(element, loaded);
			return port.request('set', typeof stored.meta !== 'object' ? loaded : {
				id,
				rating: loaded.rating,
				meta: Object.assign(stored.meta, loaded.meta),
			});
		})
		.catch(error => console.error(error) === delete element.dataset.rating);

		observer.all('img:not([data-rating="true"]), .videowall-still-image:not([data-rating="true"])', (element) => {
			const videoId = getVideoIdFromImageSrc(element);
			videoId && loadAndDisplayRating(element, videoId);
		});

		const obs = new MutationObserver(mutations => mutations.forEach(({ target: element, }) => {
			obs.takeRecords();
			if (element.dataset.rating || !element.matches || !element.matches('img, .videowall-still-image')) { return; }
			const videoId = getVideoIdFromImageSrc(element);
			videoId && loadAndDisplayRating(element, videoId);
		}));
		obs.observe(document, { subtree: true, attributes: true, attributeFilter: [ 'src', 'style', ], });

		main.once(Symbol.for('destroyed'), () => {
			obs.disconnect();
			Array.prototype.forEach.call(document.querySelectorAll('[data-rating="true"]'), element => delete element.dataset.rating);
			Array.prototype.forEach.call(document.querySelectorAll('.inserted-ratings'), element => element.remove());
			style.remove();
		});
	});
};

});
