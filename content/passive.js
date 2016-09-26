(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { createElement, },
	'node_modules/es6lib/string': { QueryObject, },
}) {

return function(main) {

	// auto load more list entries when scrolling to the bottom of a list
	function autoExpandListsOnWheel(event) {
		if ((window.scrollY + window.innerHeight) >= document.getElementById('content').offsetHeight) { // close to the bottom
			const button = document.querySelector('#watch-more-related-button, .load-more-button, .yt-uix-load-more, .browse-items-load-more-button');
			button && button.style.display !== 'none' && button.click();
		}
	}
	main.once('optionsLoaded', options => options.autoExpandLists.when({
		true: () => main.addDomListener(window, 'scroll', autoExpandListsOnWheel),
		false: () => main.removeDomListener(window, 'scroll', autoExpandListsOnWheel),
	}));

	let showingComments = false;
	main.addDomListener(document, 'mousedown', event => {
		// expand comments
		if (event.button === 0 && event.target.matches('.comment-section-header-renderer, .comment-section-header-renderer *')) {
			event.preventDefault(); event.stopPropagation();
			main.setStyle('show-comments', showingComments ? '' : `.watchpage #watch-discussion {
				max-height: 20000px !important;
				transition-duration: 0.5s;
				transition-timing-function: cubic-bezier(1, 0, 1, 1);
				transition-delay: 0s;
			}`);
			showingComments = !showingComments;
		}

		// open search results in new tab, may require user to accept popups from youtube.com
		if (event.button === 1 && event.target.matches('#search-btn, #search-btn *')) {
			event.preventDefault(); event.stopPropagation();
			window.open('/results?search_query='+ encodeURIComponent(event.target.parentNode.querySelector('#masthead-search-term').value), '_blank');
		}
	}, true);

	// add 'clear playlist' button
	main.once('observerCreated', () => main.observer.all('#watch-appbar-playlist', function(playlist) {
		let container;
		if ((container = playlist.querySelector('.appbar-playlist-controls .yt-uix-clickcard-target'))) {
			if (container.querySelector('.close-playlist-button')) { return; }
			let query = new QueryObject(window.location.search);
			delete query.list;
			delete query.index;

			let close = container.appendChild(createElement('a', {
				className: 'yt-uix-button-player-controls yt-uix-button-empty yt-uix-button-has-icon no-icon-markup yt-uix-playlistlike yt-uix-tooltip spf-link close-playlist-button',
				title: 'Clear playlist',
				style: { transform: 'rotate(45deg)', },
				href: window.location.pathname +'?'+ query.toString(),
				onmousedown() {
					query.t = main.player.video.currentTime;
					event.target.href = event.target.pathname +'?'+ query.toString();
				},
			}));
		}
	}));
};

}); })();
