'use strict'; define('content/passive', [
	'es6lib',
], function(
	{
		dom: { createElement, },
		format: { QueryObject, },
	}
) {

return function(main) {

	// auto load more
	main.options.autoExpandLists && window.addEventListener('scroll', function(event) { // ugly, but working
		if ((window.scrollY + window.innerHeight) >= document.getElementById('content').offsetHeight) { // close to the bottom
			const button = document.querySelector('#watch-more-related-button, .load-more-button, .yt-uix-load-more, .browse-items-load-more-button');
			button && button.style.display !== 'none' && button.click();
		}
	});

	// open search results in new tab, may require user to accept popups from youtube.com
	main.once('observerCreated', ({ observer, }) => observer.all('#search-btn', searchButton =>
		searchButton.handled = searchButton.handled || !void searchButton.addEventListener('mousedown', event => {
			if(event.button === 1) {
				event.preventDefault();
				event.stopPropagation();
				window.open('/results?search_query=' + searchButton.parentNode.querySelector('#masthead-search-term').value, '_blank');
			}
		}, true)
	));

	// add 'clear playlist' button
	main.once('observerCreated', ({ observer, player, }) => observer.all('#watch-appbar-playlist', function(playlist) {
		let container;
		if ((container = playlist.querySelector('.appbar-playlist-controls .yt-uix-clickcard-target'))) {
			if (container.querySelector('.close-playlist-button')) { return; }
			let close = createElement('a', {
				className: 'yt-uix-button-player-controls yt-uix-button-empty yt-uix-button-has-icon no-icon-markup yt-uix-playlistlike yt-uix-tooltip spf-link close-playlist-button',
				title: 'Clear playlist',
				style: { transform: 'rotate(45deg)', },
			});

			let queryObject = new QueryObject(window.location.search);
			delete queryObject.list;
			delete queryObject.index;
			close.href = window.location.href.split('?')[0] +'?'+ queryObject.toString();

			close.addEventListener('mousedown', function(event) {
				let queryObject = new QueryObject(event.target.search);
				queryObject.t = Math.floor(player.getTime());
				event.target.href = event.target.href.split('?')[0] +'?'+ queryObject.toString();
			});
			container.appendChild(close);
		}
	}));
};

});
