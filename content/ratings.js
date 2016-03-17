'use strict'; define('content/ratings', [
	'common/chrome', 'content/utils', 'content/templates', 'es6lib',
], function(
	{ storage, },
	{ getVideoIdFromImageSrc, },
	Templates,
	{
		concurrent: { async, spawn, sleep, timeout, },
		dom: { clickElement, createElement, CreationObserver, notify, once, saveAs, },
		format: { hhMmSsToSeconds, numberToRoundString, timeToRoundString, QueryObject, },
		functional: { noop, Logger, log, },
		object: { copyProperties, },
		network: { HttpRequest, },
	}
) {

// rotating thumb preview
function onMouseover({ target: image, }) {
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
}

function attatchRatingBar(element, { public: { likes, dislikes, views, published, }, })  {
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

const loadRatingFromServer = id => HttpRequest('https://www.youtube.com/watch?v='+ id).then(({ response, }) => ([
	{ name: 'id', regex: (/(?:)/),
		mapper: s => id, },
	{ name: 'likes', regex: (/class=".*?like-button-renderer-like-button.*?".*?><span .*?>([\d\.\,]+)<\//),
		mapper: s => parseInt(s.replace(/[\,\.]*/g, ''), 10), },
	{ name: 'dislikes', regex: (/class=".*?like-button-renderer-dislike-button.*?".*?><span .*?>([\d\.\,]+)<\//),
		mapper: s => parseInt(s.replace(/[\,\.]*/g, ''), 10), },
	{ name: 'views', regex: (/class=".*?watch-view-count.*?".*?>([\d\.\,]+)<\//),
		mapper: s => parseInt(s.replace(/[\,\.]*/g, ''), 10), },
	{ name: 'title', regex: (/<meta[^>]*?name="title"[^>]*?content="(.*?)">/),
		mapper: s => s, },
	{ name: 'published', regex: (/<meta[^>]*?itemprop="datePublished"[^>]*?content="(.*?)">/),
		mapper: s => +new Date(s), },
	{ name: 'timestamp', regex: (/(?:)/),
		mapper: s => Date.now(), },
].reduce((videoInfo, entry) => {
	videoInfo[entry.name] = entry.mapper((response.match(entry.regex) || [0,'0'])[1]);
	return videoInfo;
}, { })));


const loadVideoInfo = id => storage.local.get('videoInfo-'+ id).then(value => value['videoInfo-'+ id] || { id: id, });
const storeVideoInfo = videoInfo => storage.local.set({ ['videoInfo-'+ videoInfo.id]: videoInfo, });

const loadAndDisplayRating = (element, id) => spawn(function*() {
	element.dataset.rating = true;

	const videoInfo = (yield loadVideoInfo(id));
	if (!videoInfo.public) {
		videoInfo.public = (yield loadRatingFromServer(id));
		storeVideoInfo(videoInfo);
	}
	attatchRatingBar(element, videoInfo);

}).catch(error => console.error(error) === delete element.dataset.rating);

return function(main) {

	if (main.options.displayRatings) {
		main.once('observerCreated', ({ observer, }) => {
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
			});
		});
	}

	if (main.options.animateThumbs) {
		document.addEventListener('mouseover', onMouseover);
		main.once(Symbol.for('destroyed'), () => window.removeEventListener('mouseover', onMouseover));
	}
};

});
