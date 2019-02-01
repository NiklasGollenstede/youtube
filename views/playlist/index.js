(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/string': { secondsToHhMmSs, },
	'node_modules/es6lib/dom': { createElement: _createElement, },
	'node_modules/es6lib/object': { MultiMap, },
	'node_modules/sortablejs/Sortable': Sortable,
	'node_modules/web-ext-utils/browser/': { manifest, Runtime, Tabs, Bookmarks, SidebarAction, },
	'node_modules/web-ext-utils/browser/version': { firefox, },
	'node_modules/web-ext-utils/loader/views': { showView, openView, },
	'background/player': Player,
	'background/video-info': VideoInfo,
	'background/related-videos': relatedVideos,
	'common/dom': { scrollToCenter, },
	'common/options': options,
	'fetch!./body.html': Body,
	'fetch!./layout.css:css': layout_css,
	'fetch!./theme/dark.css:css': theme_dark_css,
	'fetch!./theme/light.css:css': theme_light_css,
	Events,
}) => {

const CSS = { layout: layout_css, theme: { dark: theme_dark_css, light: theme_light_css, }, };

return async function View(window) {

	Events.register(window);
	const { document, } = window, createElement = _createElement.bind(window), off = { owner: window, };
	const MediaTile = window.MediaTile = window.customElements.get('media-tile');
	function createTile(id) { const tile = new MediaTile; tile.videoId = id; return tile; }

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
		const tiles = document.querySelector('#playlist .tiles'); tiles.textContent = ''; enableDragIn(tiles);
		Player.playlist.forEach(id => tiles.appendChild(createTile(id)));

		Player.playlist.onAdd((index, id) => tiles.insertBefore(createTile(id), tiles.children[index]), off);
		Player.playlist.onRemove(index => tiles.children[index].remove(), off);

		Player.playlist.onSeek(seek, off); seek(Player.playlist.index);
		function seek(index) {
			tiles.querySelectorAll('.active').forEach(tab => tab.classList.remove('active'));
			if (!tiles.children[index]) { return; }
			tiles.children[index].classList.add('active');
			if (tiles.matches(':hover')) { return; }
			scrollToCenter(tiles.children[index], { tolerance: .75, });
		}
	}

	{ // related (to current)
		const group = groupList.appendChild(createGroup(window, 'related-this', 'related-this', 'Related to Video'));
		const tiles = group.querySelector('.tiles'); enableDragOut(tiles);
		async function update() {
			const id = Player.playlist.get();
			const ids = id && (await VideoInfo.getData(id)).related || [ ];
			tiles.textContent = '';
			ids.forEach(id => tiles.appendChild(createTile(id)));
		} update(); Player.playlist.onSeek(update, off);
	}

	{ // related (to playlist)
		const related = relatedVideos.subscribe(window);
		const group = groupList.appendChild(createGroup(window, 'related-all', 'related-all', 'Top Related'));
		const tiles = group.querySelector('.tiles'); enableDragOut(tiles);
		related.forEach((item, index) => add(item, index));
		related.onAdd(async (index, item) => add(item, index), off);
		related.onRemove(index => tiles.children[index].remove(), off);
		async function add({ count, id, relating, }, index) {
			const tile = tiles.insertBefore(createTile(id), tiles.children[index]);
			tile.dataset.count = count; tile.dataset.relating = relating.join(' ');
			tile.dataset.category = (await VideoInfo.getData(id)).category;
			tile.title = tile.dataset.category +': '+ tile.dataset.relating;
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
		const { setTimeout, requestAnimationFrame: next, } = window;
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
			const current = progress.value = Player.currentTime, sec = current |0;
			sec !== lastSec && (time.textContent = secondsToHhMmSs((lastSec = sec)));
		}
	}

	[ 'prev', 'play', 'pause', 'next', 'loop', ]
	.forEach(command => document.querySelector('#'+ command).addEventListener('click', ({ button, }) => !button && Player[command]()));

	document.querySelector('#more').addEventListener('click', showMainMenu);

	(await tabsLoaded); (await bookmarksLoaded);
};

function showMainMenu(event) {
	if (event.button) { return; } const document = event.target.ownerDocument;

	const menu = document.mainMenu || (document.mainMenu = new (document.defaultView.customElements.get('context-menu'))({ items: [
		{ icon: '⚡',	label: 'Restart ytO', action: () => Runtime.reload(), },
		{ icon: '◑',	label: 'Dark Theme', action() { options.playlist.children.theme.value = this.checked ? 'light' : 'dark'; }, get checked() { return options.playlist.children.theme.value === 'dark'; }, },
		{ icon: '❐', 	label: 'Show Playlist in Tab', action: () => showView('playlist', 'tab'), },
		{ icon: '◳', 	label: 'Open Playlist in Popup', action: () => openView('playlist', 'popup', { width: 450, height: 600, }), },
		SidebarAction && SidebarAction.open &&
		{ icon: '◫', 	label: 'Show Playlist Sidebar', action: () => SidebarAction.open(), },
		{ icon: '🎞️', 	label: 'Show Video Player', action: () => showView('video', 'tab'), }, // 📽
		{ icon: '⚙', 	label: 'Show Settings', action: () => showView('options', 'tab'), },
	], autoReflow: false, }));

	const { left: x, bottom: y, width, } = document.querySelector('#more').getBoundingClientRect();
	menu.setPosition({ x, y, width, }); document.documentElement.appendChild(menu); menu.resetReflow();

	menu.shadowRoot.querySelector('.menu').classList.add('to-left'); menu.reflowMenus(false);
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
			transfer.setData('<yTO-internal>', '{"pull":true}');
		},
	}));
}
function enableDragIn(tiles) {
	try { Sortable.prototype._nulling(); } catch (_) { } // pretty save to assume that there is no element being dragged, so do this to try to prevent bugs when Sortable.js is stuck in some invalid state
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
			transfer.setData('<yTO-internal>', '{"sort":true}');
		},
		onAdd({ item, newIndex, }) {
			item.remove();
			// tiles.querySelectorAll('media-tile:not(.in-playlist)').forEach(_=>_.remove()); // remove any inserted items
			const { x, y, } = Events.listeners.dragover, { top, left, bottom, right, } = tiles.getBoundingClientRect();
			if (top > y || bottom < y || left > x || right < x) { return; } // TODO: this broken!
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
