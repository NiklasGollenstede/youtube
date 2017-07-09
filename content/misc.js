(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/concurrent': { sleep, before, },
	'node_modules/es6lib/dom': { createElement, },
	'node_modules/es6lib/string': { QueryObject, /*timeToRoundString,*/ },
	dom,
	Observer,
	options,
	player,
}) => { /* global window, document, URL, */

// increase quality of the video poster
const posters = new Map;
player.on('unstarted', async () => {
	const videoId = new global.URL(global.location).searchParams.get('v');
	if (!videoId) { return; }
	const blob = posters.get(videoId) || (await (await global.fetch(`https://i.ytimg.com/vi/${ videoId }/maxresdefault.jpg`)).blob());
	posters.set(videoId, blob);
	dom.setStyle('hd-poster', String.raw`.ytp-thumbnail-overlay-image {
		background-image: url("${ URL.createObjectURL(blob) }") !important;
	}`);
});

// another hack to make sure Autoplay is disabled
player.on('ended', checkbox => (checkbox = document.querySelector('#autoplay-checkbox')) && checkbox.checked && checkbox.click());
// and a hack to force the video to continue if it is stuck at ~5s
player.on('buffering', async time => {
	if (!player.loaded || time < 2.5 || time > 8) { return; }
	console.log('forcing play on buffer');
	player.play(); player.video.play();
	if ((await before(player.promise('playing'), sleep(2000)))) { return; }
	// didn't start within 2000 ms
	console.log('still buffering, seeking by +1 sec');
	(await player.seekTo(time + 1));
	if ((await before(player.promise('playing'), sleep(5000)))) { return; }
	console.log('still not playing -.-');
});

// update the private view count
/*async function displayViews() {
	(await sleep(300)); // allow the view counter to be updated
	const { duration, } = (await player.getInfo());
	const { viewed = 0, } = (await port.request('db.get', main.videoId, [ 'viewed', ]));
	const views = document.querySelector('.watch-view-count');
	delete views.dataset.tooltipText;
	views.title = (duration ? (viewed / duration).toFixed(1).replace('.0', '') +' times' : timeToRoundString(viewed * 1000, 1.7)) +' by you';
	views.classList.add('yt-uix-tooltip');
	views.style.display = 'block';
}
player.on('paused', displayViews); player.on('ended', displayViews);*/

// auto load more list entries when scrolling to the bottom of a list
function autoExpandListsOnWheel(event) {
	if ((window.scrollY + window.innerHeight) >= document.getElementById('content').offsetHeight) { // close to the bottom
		const button =
		   document.querySelector('#watch-more-related-button') // more related videos
		|| document.querySelector('.yt-uix-load-more') // more channel videos
		|| document.querySelector('.browse-items-load-more-button')
		|| document.querySelector('.load-more-button') // more comments or channel videos
		;
		button && button.style.display !== 'none' && button.click();
	}
}
options.autoExpandLists.when({
	true:  () => dom.on (window, 'scroll', autoExpandListsOnWheel),
	false: () => dom.off(window, 'scroll', autoExpandListsOnWheel),
});

dom.on(document, 'mousedown', event => {
	// expand comments
	if (event.button === 0 && event.target.matches('.comment-section-header-renderer, .comment-section-header-renderer *')) {
		event.preventDefault(); event.stopPropagation();
		document.body.classList.toggle('show-comments');
	}

	// open search results in new tab, may require user to accept popups from youtube.com
	if (event.button === 1 && event.target.matches('#search-btn, #search-btn *')) {
		event.preventDefault(); event.stopPropagation();
		window.open('/results?search_query='+ encodeURIComponent(event.target.parentNode.querySelector('#masthead-search-term').value), '_blank');
	}
}, true);

// add 'clear playlist' button
Observer.all('#watch-appbar-playlist', playlist => {
	let container;
	if ((container = playlist.querySelector('.appbar-playlist-controls .yt-uix-clickcard-target'))) {
		if (container.querySelector('.close-playlist-button')) { return; }
		const query = new QueryObject(window.location.search);
		delete query.list;
		delete query.index;

		container.appendChild(createElement('a', {
			className: 'yt-uix-button-player-controls yt-uix-button-empty yt-uix-button-has-icon no-icon-markup yt-uix-playlistlike yt-uix-tooltip spf-link close-playlist-button',
			title: 'Clear playlist',
			style: { transform: 'rotate(45deg)', },
			href: window.location.pathname +'?'+ query.toString(),
			onmousedown(event) {
				query.t = player.video.currentTime;
				event.target.href = event.target.pathname +'?'+ query.toString();
			},
		}));
	}
});

}); })(this);
