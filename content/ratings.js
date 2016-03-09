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

let options, observer;

function enableThumbPreview() {
	document.addEventListener('mouseover', event => {
		let element = event.target;
		if (!element.videoInfo || element.videoInfo.originalSrc) { return; }
		element.videoInfo.originalSrc = element.nodeName == "IMG" ? element.src : element.style.backgroundImage;

		let id = element.videoInfo.id = element.videoInfo.id || getVideoIdFromImageSrc(element);
		let i = 0, url = "";
		(function displayNextThumbRecursion() {
			if (!element.videoInfo.originalSrc) { return; }
			if (++i > 3) { i = 1; }
			url = "https://i.ytimg.com/vi/" + id + "/" + i + ".jpg";
			if (element.nodeName == "IMG") {
				element.src = url;
			} else {
				element.style.backgroundImage = url;
			}
			setTimeout(displayNextThumbRecursion, 1000);
		})();

		once(element, 'mouseout', event => {
			if (element.nodeName == "IMG") {
				element.src = element.videoInfo.originalSrc;
			} else {
				element.style.backgroundImage = element.videoInfo.originalSrc;
			}
			element.videoInfo.originalSrc = undefined;
		});
	});
}

function attatchRatingBar(element)  {
	let likes, dislikes, total;
	if (
		!(
			element.videoInfo
			&& element.videoInfo.public
			&& (total = (likes = element.videoInfo.public.likes) + (dislikes = element.videoInfo.public.dislikes) || 1)
		)
		|| element.querySelector(".video-extras-sparkbarks")
	) { console.error('elements videoInfo misformed', element.videoInfo); return; }
	const views = element.videoInfo.public.views || 0;
	const published = element.videoInfo.public.published || 0;

	if (element.nodeName == "IMG") {
		element = element.parentNode;
		if (element.matches(".yt-thumb-clip")) {
			element = element.parentNode;
		}
	}
	element.classList.add("yt-uix-tooltip");
	element.insertAdjacentHTML('beforeend', Templates.ratingsBar(likes, dislikes, total));

	element.title = Templates.videoInfoTitle(likes, dislikes, views, published);
}

const loadRatingFromServer = id => HttpRequest("https://www.youtube.com/watch?v="+ id).then(({ response, }) => ([
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


const loadVideoInfo = id => storage.local.get('videoInfo-'+ id).then(value => value['vieoInfo-'+ id] || { id: id, });
const storeVideoInfo = videoInfo => storage.local.set({ ['videoInfo-'+ videoInfo.id]: videoInfo, });

const loadAndDisplayRating = (element, id) => spawn(function*() {
	if (!options.displayRatings || element.dataset.rating) { return; }
	element.dataset.rating = true;
	element.videoInfo = element.videoInfo || { id, };

	let fromCache = true;

	const videoInfo = (yield loadVideoInfo(id));

	if (!videoInfo.public) {
		videoInfo.public = (yield loadRatingFromServer(id));
		storeVideoInfo(videoInfo);
	}
	copyProperties(element.videoInfo, videoInfo);
	attatchRatingBar(element);

}).catch(error => console.error(error) === delete element.dataset.rating);

function displayRatingOnImageLoad() {
	observer.all('img:not([data-rating="true"]), .videowall-still-image:not([data-rating="true"])', (element, id) =>
		!(element.videoInfo && element.dataset.rating)
		&& (id = getVideoIdFromImageSrc(element))
		&& !element.querySelector(".video-extras-sparkbarks")
		&& loadAndDisplayRating(element, id)
	);

	new MutationObserver(mutations => mutations.forEach((mutation, id) =>
		!(mutation.target.videoInfo && mutation.target.dataset.rating)
		&& (id = getVideoIdFromImageSrc(mutation.target))
		&& loadAndDisplayRating(mutation.target, id)
	)).observe(document, { subtree: true, attributes: true, attributeFilter: ["src", "style"] });
}

return function(main) {
	main.once('observerCreated', main => {
		options = main.options; observer = main.observer;
		(options.displayRatings || options.animateThumbs) && displayRatingOnImageLoad();
		options.animateThumbs && enableThumbPreview();
	});
};

});
