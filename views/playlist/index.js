(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/string': { secondsToHhMmSs, },
	'node_modules/es6lib/dom': { createElement: _createElement, },
	'node_modules/es6lib/object': { MultiMap, },
	'node_modules/sortablejs/Sortable': Sortable,
	'node_modules/web-ext-utils/browser/': { manifest, Runtime, Tabs, Bookmarks, SidebarAction, },
	'node_modules/web-ext-utils/browser/version': { firefox, },
	'node_modules/web-ext-utils/loader/views': { showView, openView, },
	'background/player': Player,
	'background/video-info': { makeTileClass, },
	'common/context-menu': ContextMenu,
	'common/dom': { scrollToCenter, },
	'common/options': options,
	'fetch!./body.html': Body,
	'fetch!./layout.css': layout_css,
	'fetch!./theme/dark.css': theme_dark_css,
	'fetch!./theme/light.css': theme_light_css,
	Events,
	require,
}) => {

const CSS = {
	layout: layout_css +`\n/*# sourceURL=${ require.toUrl('./layout.css') } */`,
	theme: {
		dark: theme_dark_css +`\n/*# sourceURL=${ require.toUrl('./theme/dark.css') } */`,
		light: theme_light_css +`\n/*# sourceURL=${ require.toUrl('./theme/light.css') } */`,
	},
};

return async function View(window) {

	Events.register(window);
	const { document, } = window, createElement = _createElement.bind(window), off = { owner: window, };
	const MediaTile = window.MediaTile = makeTileClass(window);

	document.title = 'Playlist - '+ manifest.name;
	document.head.appendChild(createElement('style', { textContent: CSS.layout, }));
	document.head.appendChild(createElement('link', { rel: 'stylesheet', href: `/common/context-menu.css`, }));
	const theme = document.head.appendChild(createElement('style'));
	options.playlist.children.theme.whenChange(value => {
		document.body.classList.add('no-transitions');
		theme.textContent = CSS.theme[value];
		global.setTimeout(() => document.body.classList.remove('no-transitions'), 70);
	}, off);

	document.body.lang = global.navigator.language;
	document.body.innerHTML = Body;
	document.documentElement.classList.add('no-transitions');
	global.setTimeout(() => document.documentElement.classList.remove('no-transitions'), 1e3);

	const groupList = document.querySelector('#groups .groups'); groupList.textContent = '';

	{ // playlist
		const ids = Player.playlist.current;
		const tiles = document.querySelector('#playlist .tiles'); tiles.textContent = '';
		enableDragIn(tiles);
		const createTile = id => { const tile = new MediaTile; tile.videoId = id; /*tile.classList.add('in-playlist');*/ return tile; };
		ids.forEach(id => tiles.appendChild(createTile(id)));

		Player.playlist.onAdd((index, id) => tiles.insertBefore(createTile(id), tiles.children[index]), off);
		Player.playlist.onRemove(index => tiles.children[index].remove(), off);

		Player.playlist.onSeek(seek, off); seek(Player.playlist.index);
		function seek(index) {
			tiles.querySelectorAll('.active').forEach(tab => tab.classList.remove('active'));
			if (!tiles.children[index]) { return; }
			tiles.children[index].classList.add('active');
			if (tiles.matches(':hover')) { return; }
			scrollToCenter(tiles.children[index]);
		}
	}

	const tabsLoaded = (async () => { // videos open in tabs
		const openVideos = Player.getOpenVideos();
		const group = groupList.appendChild(createGroup(window, 'tabs', 'tabs', 'Open Tabs'));
		const tiles = group.querySelector('.tiles'); enableDragOut(tiles);
		function addTile(tiles, { videoId, tabId, }) { const tile = tiles.appendChild(new MediaTile); tile.videoId = videoId; tile.dataset.tabId = tabId; }
		openVideos.forEach(ids => addTile(tiles, ids));

		Player.onVideoOpen(addTile.bind(null, tiles), off);
		Player.onVideoClose(({ tabId, }) => tiles.querySelector(`media-tile[data-tab-id="${tabId}"]`).remove(), off);

		if (firefox) { // videos in unloaded tabs
			const group = groupList.appendChild(createGroup(window, 'unloaded', 'unloaded', 'Unloaded Tabs'));
			const tiles = group.querySelector('.tiles'); enableDragOut(tiles);

			Tabs.query({ url: [ `https://www.youtube.com/watch?*v=*`, `https://gaming.youtube.com/watch?*v=*`, ], }).then(_=>_
				.sort((a, b) => (/*a.windowId << 16 + */a.index) - (/*b.windowId << 16 + */b.index))
				.forEach(tab => {
					const videoId = (tab.url.match(/\bv=([\w-]{11})\b/) || [ ])[1];
					videoId && !openVideos.some(_=>_.tabId === tab.id) && addTile(tiles, { videoId, tabId: tab.id, });
				})
			);

			function removeTab(tab) { const tile = tiles.querySelector(`media-tile[data-tab-id="${ typeof tab === 'number' ? tab : tab.tabId }"]`); tile && tile.remove(); }
			Player.onVideoOpen(removeTab, off); Tabs.onRemoved.addListener(removeTab); window.addEventListener('unload', () => Tabs.onRemoved.removeListener(removeTab));
		}
	})();

	// bookmarked videos
	const bookmarksLoaded = (async () => {
		const parents = new MultiMap; (await Bookmarks.search({ query: `youtube.com/watch?`, }))
		.forEach(item => parents.add(item.parentId, item));
		parents.forEach(async (children, parentId) => {
			const entries = Array.from(children).sort((a, b) => a.index - b.index).map(entry => {
				const mId = entry.url.match(/\bv=([\w-]{11})\b/);
				return mId ? { videoId: mId[1], bookmarkId: entry.id, } : null;
			}).filter(_=>_);
			if (!entries.length) { return; }
			const [ { title, }, ] = (await Bookmarks.get(parentId));
			const group = groupList.appendChild(createGroup(window, 'bmk-'+ parentId, 'bmk-'+ parentId, createElement('span', null, [
				createElement('span', { title: 'Bookmark folder', }, [ '🔖 ', ]), title,
			])));
			const tiles = group.querySelector('.tiles');
			enableDragOut(tiles);
			const addTile = ({ videoId, bookmarkId, }) => (tiles.appendChild(Object.assign(new MediaTile, { videoId, })).dataset.bookmarkId = bookmarkId);
			entries.forEach(addTile);
		});
		const onRemoved = bookmarkId => document.querySelector(`media-tile[data-bookmark-id="${ bookmarkId }"]`).remove();
		Bookmarks.onRemoved.addListener(onRemoved); window.addEventListener('unload', () => Bookmarks.onRemoved.removeListener(onRemoved));
	})();

	{ // controls
		options.playlist.children.loop.whenChange(([ value, ]) => document.querySelector('#loop').classList[value ? 'add' : 'remove']('active'), off);
		Player.onPlay(playing, off); Player.playing && playing(true);
		function playing(playing) {
			document.querySelector( playing ? '#play' : '#pause').classList.add('active');
			document.querySelector(!playing ? '#play' : '#pause').classList.remove('active');
			const active = playing && document.querySelector('#playlist:not(:hover) .tiles media-tile.active');
			active && scrollToCenter(active);
		}
	}

	{ // seek-bar
		let looping = false, lastSec = -1;
		const progress = document.querySelector('#progress>input'), time = document.querySelector('#current-time');
		const next = window.requestAnimationFrame;
		Player.onPlay(check, off); Player.onDurationChange(check, off); Player.onSeek(check, off); check(); async function check() {
			if (!Player.duration) { // stop & hide
				document.querySelector('#seek-bar').classList.add('hidden');
				looping = false;
			} else { // show
				document.querySelector('#seek-bar').classList.remove('hidden');
				document.querySelector('#total-time').textContent = secondsToHhMmSs(Player.duration);
				progress.max = Player.duration;
				if (Player.playing) { if (!looping) { looping = true; loop(); } } // start
				else { looping = false; set(); } // stop
			}
		}
		function loop() { set(); looping && setTimeout(next, 250, loop); } // doing this at 60fps is quite expensive
		function set() {
			const current = Player.currentTime;
			progress.value = current;
			const sec = current <<0;
			sec !== lastSec && (time.textContent = secondsToHhMmSs((lastSec = sec)));
		}
	}

	[ 'prev', 'play', 'pause', 'next', 'loop', ]
	.forEach(command => document.querySelector('#'+ command).addEventListener('click', ({ button, }) => !button && Player[command]()));

	document.querySelector('#more').addEventListener('click', showMainMenu);

	(await tabsLoaded); (await bookmarksLoaded);
};

function showMainMenu(event) {
	if (event.button) { return; }
	const document = event.target.ownerDocument;
	const { left: x, bottom: y, width, } = document.querySelector('#more').getBoundingClientRect();
	const items = [
		{ icon: '⚡',	label: 'Restart', action: () => Runtime.reload(), },
		{ icon: '◑',	label: 'Dark Theme', checked: options.playlist.children.theme.value === 'dark', action() { options.playlist.children.theme.value = this.checked ? 'light' : 'dark'; }, },
		{ icon: '❐', 	label: 'Show in tab', action: () => showView('playlist', 'tab'), },
		{ icon: '◳', 	label: 'Open in popup', action: () => openView('playlist', 'popup', { width: 450, height: 600, }), },
		SidebarAction && SidebarAction.open &&
		{ icon: '◫', 	label: 'Open sidebar', action: () => SidebarAction.open(), },
		{ icon: '▶', 	label: 'Show video', action: () => showView('video', 'tab'), },
		{ icon: '⚙', 	label: 'Settings', action: () => showView('options', 'tab'), },
	];
	new ContextMenu({ x, y: y + 1, width, items, host: document.body, });
}

// enable drag & drop
function enableDragOut(tiles) {
	return (tiles.sortable = new Sortable(tiles, {
		group: {
			name: 'playlist',
			pull: 'clone',
			put: false,
		},
		handle: '.icon',
		draggable: 'media-tile',
		ghostClass: 'ghost',
		animation: 500,
		scroll: true,
		scrollSensitivity: 90,
		scrollSpeed: 10,
		sort: false,
		setData(transfer, item) { // insert url if dropped somewhere else
			transfer.clearData();
			transfer.setData('text/plain', 'https://www.youtube.com/watch?v='+ item.videoId);
			transfer.setData('text/uri-list', 'https://www.youtube.com/watch?v='+ item.videoId);
			transfer.setData('<yTO-internal>', 'pull');
		},
	}));
}
function enableDragIn(tiles) {
	return (tiles.sortable = new Sortable(tiles, {
		group: {
			name: 'playlist',
			pull: false,
			put: true,
		},
		handle: '.icon',
		draggable: 'media-tile',
		ghostClass: 'ghost',
		animation: 500,
		scroll: true,
		scrollSensitivity: 90,
		scrollSpeed: 10,
		sort: true,
		setData(transfer, item) { // insert url if dropped somewhere else
			transfer.clearData();
			transfer.setData('text/plain', 'https://www.youtube.com/watch?v='+ item.videoId);
			transfer.setData('text/uri-list', 'https://www.youtube.com/watch?v='+ item.videoId);
			transfer.setData('<yTO-internal>', 'sort');
		},
		onAdd({ item, newIndex, }) {
			item.remove();
			// tiles.querySelectorAll('media-tile:not(.in-playlist)').forEach(_=>_.remove()); // remove any inserted items
			const { x, y, } = Events.listeners.dragover, { top, left, bottom, right, } = tiles.getBoundingClientRect();
			if (top > y || bottom < y || left > x || right < x) { return; }
			Player.playlist.splice(newIndex, 0, item.getAttribute('video-id')); // use getAttribute to retrieve IDs of cross-window drops
		},
		onUpdate({ item, newIndex, oldIndex, }) { // sorted within
			// put back to old position (in *this* view), then update list and thereby *all* views
			item.remove(); tiles.insertBefore(item, tiles.children[oldIndex]);
			// first insert, then seek, then remove to keep the player playing
			if (newIndex > oldIndex) { newIndex += 1; } else { oldIndex += 1; } // because of that order, the indices have to be adjusted
			Player.playlist.splice(newIndex, 0, item.videoId);
			item.matches('.active') && (Player.playlist.index = newIndex); // this seeks between items with the same ID
			Player.playlist.splice(oldIndex, 1);
		},
	}));
}

function createGroup(window, id, className, title) { return _createElement.call(window, 'div', { id: 'group-'+ id, className: 'group '+className, }, [
	_createElement.call(window, 'div', { className: 'header', }, [
		_createElement.call(window, 'label', { className: 'toggleswitch title', htmlFor: 'groupToggle-'+ id, }, [ title, ]),
	]),
	_createElement.call(window, 'input', { className: 'toggleswitch', type: 'checkbox', id: 'groupToggle-'+ id, }),
	_createElement.call(window, 'span', { className: 'tiles', }),
]); }

}); })(this);
