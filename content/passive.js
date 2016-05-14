'use strict'; define('content/passive', [
	'es6lib',
], function(
	{
		dom: { createElement, },
		format: { QueryObject, },
	}
) {

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

	// open search results in new tab, may require user to accept popups from youtube.com
	main.addDomListener(document, 'mousedown', event => {
		if (event.button !== 1 || !event.target.matches('#search-btn')) { return; }
		event.preventDefault(); event.stopPropagation();
		window.open('/results?search_query='+ encodeURIComponent(event.target.parentNode.querySelector('#masthead-search-term').value), '_blank');
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

});
