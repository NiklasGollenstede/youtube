(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/string': { fuzzyIncludes, secondsToHhMmSs, },
	'node_modules/es6lib/dom': { createElement: _createElement, writeToClipboard, },
	'node_modules/es6lib/object': { MultiMap, },
	'node_modules/sortablejs/Sortable': Sortable,
	'node_modules/web-ext-utils/browser/': { manifest, extension, Tabs, Windows, Bookmarks, sidebarAction, },
	'node_modules/web-ext-utils/browser/version': { firefox, gecko, },
	'node_modules/web-ext-utils/loader/views': { openView, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'background/player': Player,
	'background/video-info': { makeTileClass, },
	'common/context-menu': ContextMenu,
	'common/options': options,
	'fetch!./body.html': Body,
	'fetch!./layout.css': layout_css,
	'fetch!./theme/dark.css': theme_dark_css,
	'fetch!./theme/light.css': theme_light_css,
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
		const createTile = id => { const tile = new MediaTile; tile.videoId = id; tile.classList.add('in-playlist'); return tile; };
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
		Player.onPlay(check, off); Player.onDurationChange(check, off); check(); async function check() {
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
	document.addEventListener('contextmenu', showContextMenu);
	document.addEventListener('dblclick', onDblckick);
	document.addEventListener('click', onClick);
	document.addEventListener('keydown', onKeydown);
	document.addEventListener('input', onInput);
	document.addEventListener('copy', onCopy);
	document.addEventListener('paste', onPaste);
	document.addEventListener('drop', onDrop);
	document.addEventListener('dragover', onDragover, true);

	(await tabsLoaded); (await bookmarksLoaded);
};

function showMainMenu(event) {
	if (event.button) { return; }
	const document = event.target.ownerDocument;
	const { left: x, bottom: y, width, } = document.querySelector('#more').getBoundingClientRect();
	const items = [
		{ icon: '⚡',	label: 'Restart', action: () => extension.getBackgroundPage().location.reload(), },
		{ icon: '◑',	label: 'Dark Theme', checked: options.playlist.children.theme.value === 'dark', action() { options.playlist.children.theme.value = this.checked ? 'light' : 'dark'; }, },
		{ icon: '❐', 	label: 'Show in tab', action: () => openView('playlist', 'tab'), },
		{ icon: '◳', 	label: 'Open in popup', action: () => openView('playlist', 'popup', { useExisting: false, width: 450, height: 600, }), },
		{ icon: '▶', 	label: 'Show video', action: () => openView('video', 'tab'), },
		gecko && { icon: '◫', 	label: 'Open sidebar', action: () => sidebarAction.open(), },
		{ icon: '⚙', 	label: 'Settings', action: () => openView('options', 'tab'), },
	];
	new ContextMenu({ x, y: y + 1, width, items, host: document.body, });
}

// show context menus
function showContextMenu(event) {
	event.preventDefault(); ContextMenu.remove();
	const { target, clientX: x, clientY: y, } = event;
	if (!target.matches) { return; }
	const document = event.target.ownerDocument;
	const others = document.querySelector('#groups');
	const playlist = document.querySelector('#playlist .tiles');
	const items = [ ];
	const tile = target.closest('media-tile');
	const group = target.closest('.group');
	const inList = !!target.closest('#playlist');
	if (tile) {
		const id = tile.videoId;
		const tab = Player.frameFor(id);
		const inTabs = target.closest('#group-tabs, #group-unloaded');
		const bmkId = Array.from(others.querySelectorAll(`media-tile[video-id="${ id }"]`), _=>_.dataset.bookmarkId).find(_=>_);
		const addBmk = inList && !bmkId;
		items.push(
			           { icon: '▶',		label: 'Play video',       action: () => { Player.current = id; Player.play(); }, default: tile.matches('#playlist :not(.active)') && !target.closest('.remove, .icon'), },
			 tab    && { icon: '👁',	label: 'Show tab',         action: () => { focusTab(id); }, default: tile.matches('#group-tabs *, .active') && !target.closest('.remove, .icon'), },
			!tab    && { icon: '◳',		label: 'Open in tab',      action: () => { openTab(id); }, },
			 inList && { icon: '❏',		label: 'Duplicate',        action: () => Player.playlist.splice(positionInParent(tile), 0, id), },
			 inList && { icon: '⨉',		label: 'Remove entry',     action: () => Player.playlist.splice(positionInParent(tile), 1), default: target.matches('#playlist .remove'), },
			 inTabs && { icon: '⨉',		label: 'Close tab',        action: () => inTabs.closest('#group-tabs') ? Tabs.remove(tab.tabId) : closeUnloadedTab(tile), default: !!target.closest('#group-tabs .remove'), },
			 bmkId  && { icon: '🗑',	label: 'Delete bookmark',  action: () => Bookmarks.remove(bmkId), default: !!target.closest('media-tile[data-bookmark-id] .remove'), },
			 addBmk && { icon: '➕',	label: 'Add bookmark',     action: () => Bookmarks.create({ title: tile.querySelector('.title').textContent, url: 'https://www.youtube.com/watch?v='+ tile.videoId, }), },
			 inList && { icon: '🔍',	label: 'Highlight',        action: () => highlight(others.querySelector(`media-tile[video-id="${ id }"]`)), },
			!inList && { icon: '🔍',	label: 'Highlight',        action: () => highlight(playlist.querySelector(`media-tile[video-id="${ id }"]`)), },
			           { icon: '📋',	label: 'Copy ID',          action: () => writeToClipboard(id).then(() => notify.success('Copied video ID', id), notify.error), },
			!inList && { icon: '➕',	label: 'Add video',        action: () => Player.playlist.splice(Infinity, 0, id), },
		);
	}
	if (inList) {
		items.push(
			{ icon: '⇵',	 label: 'Sort by',                      type: 'menu', children: [
				{ icon: '⌖',	 label: 'position',                     action: () => Player.playlist.sort('position').catch(notify.error.bind(null, 'Sorting failed')), },
				{ icon: '👓',	 label: 'views',                        type: 'menu', children: [
					{ icon: '🌐',	 label: 'global',                       action: () => Player.playlist.sort('viewsGlobal').catch(notify.error.bind(null, 'Sorting failed')), },
					{ icon: '⏱',	 label: 'yours in total duration',      action: () => Player.playlist.sort('viewsDuration').catch(notify.error.bind(null, 'Sorting failed')), },
					{ icon: '↻',	 label: 'yours in times viewed',        action: () => Player.playlist.sort('viewsTimes').catch(notify.error.bind(null, 'Sorting failed')), },
				], },
				{ icon: '🔀',	 label: 'Shuffle',                      action: () => Player.playlist.sort('random').catch(notify.error.bind(null, 'Sorting failed')), },
			], },
			{ icon: '🛇',	 label: 'Clear list',                   action: () => Player.playlist.splice(0, Infinity), },
		);
	}
	if (target.closest('.group .header .title')) {
		const box = document.querySelector('#'+ target.htmlFor);
		items.push(
			{ icon: '⇳',	 label: (box.checked ? 'Expand' : 'Collapse') +' tab list', action: () => (box.checked = !box.checked), default: true, }
		);
	}
	if (group) {
		const tiles = Array.from(group.querySelectorAll(document.body.classList.contains('searching') ? 'media-tile.found' : 'media-tile'));
		tiles.length > 1 && items.push(
			{ icon: '⋯',	 label: 'Add all '+   tiles.length, action: () => Player.playlist.splice(0, Infinity, ...tiles.map(_=>_.videoId)), },
		);
	}
	// ' 🔉 🔈 🔇 🔂 🔁 🔜 🌀 🔧 ⫶ 🔞 '; // some more icons

	if (!items.length) { return; }
	new ContextMenu({ x, y, items, host: document.body, });
}

function importVideosFromText(text) {
	const ids = text.trim().split(/[\s,;]+/g).map(string => { switch (true) {
		case (/^[\w-]{11}$/).test(string): return string;
		case string.startsWith('https://www.youtube.com/watch'): return new URL(string).searchParams.get('v');
	} return null; }).filter(_=>_);
	Player.playlist.splice(Player.playlist.index + 1, 0, ...ids);
	notify.success(`Added ${ids.length} video${ ids.length === 1 ? '' : 's' }:`, ids.join(' '));
}

// focus tab (windows) or play tab on dblclick
function onDblckick({ target, button, }) {
	if (button || !target.matches) { return; }
	const document = target.ownerDocument;

	const tile = target.closest('media-tile');
	if (tile && tile.closest('#playlist')) {
		if (tile.matches('.active')) {
			focusTab(tile.videoId);
		} else {
			Player.playlist.index = positionInParent(tile);
		}
	} else if (tile) {
		focusTab(tile.videoId); // TODO: use 'data-tab-id'
	} else if (target.closest('video')) {
		target.closest('video').requestFullscreen();
	}
	document.defaultView.getSelection().removeAllRanges();
}

// remove tab on left click on ".remove"
function onClick({ target, button, }) {
	if (button || !target.closest) { return; }
	const document = target.ownerDocument;

	const tile = target.closest('media-tile'); if (tile && target.closest('.remove')) {
		if (tile.closest('#playlist')) {
			Player.playlist.splice(positionInParent(tile), 1);
		} else if ('tabId' in tile.dataset) {
			Tabs.remove(+tile.dataset.tabId);
		} else if ('bookmarkId' in tile.dataset) {
			Bookmarks.remove(tile.dataset.bookmarkId);
		}
	} else if (target.closest('#searchbox .remove')) {
		const box = document.querySelector('#searchbox>input');
		box.value = ''; box.blur();
		document.body.classList.remove('searching');
	} else if (target.closest('video')) {
		Player.toggle();
	}
}

function onKeydown(event) { try {
	const document = event.target.ownerDocument;
	const inInput = event.target.matches('TEXTAREA, input:not([type="range"])');
	switch (event.key) {
		case 'f': {
			if (!event.ctrlKey) { return; }
			const box = document.querySelector('#searchbox>input');
			box.focus(); box.select();
		} break;
		case 'o': {
			if (!event.ctrlKey) { return; }
			const reply = document.defaultView.prompt('Please paste a comma, space or line separated list of YouTube video IDs or URLs below:');
			importVideosFromText(reply);
		} break;
		case 'Escape': {
			if (event.ctrlKey || !event.target.matches('#searchbox>input')) { return; }
			event.target.value = ''; event.target.blur();
			document.body.classList.remove('searching');
		} break;
		case ' ': {
			if (inInput) { return; }
			Player.toggle();
		} break;
		default: return;
	}
	event.preventDefault(); event.stopPropagation();
} catch (error) { notify.error(error); } }

function onInput({ target, }) {
	const document = target.ownerDocument;
	if (target.matches('#searchbox>input')) {
		const term = target.value.trim();
		const lTerm = term.toLowerCase();
		const tiles = Array.from(document.querySelectorAll('#groups media-tile'));
		tiles.forEach(_=>_.classList.remove('found'));

		if (term.length < 3) { document.body.classList.remove('searching'); return; }
		else { document.body.classList.add('searching'); }

		// looking for trigrams makes it quite unlikely to match just anything, but a typo will have quite an impact
		const found = tiles.filter(tile => fuzzyIncludes(tile.querySelector('.icon').title.toLowerCase(), lTerm, 3) > 0.6);
		term.length === 11 && found.push(...tiles.filter(_=>_.videoId === term));
		found.forEach(_=>_.classList.add('found'));
	} else if (target.matches('#progress>input')) {
		Player.seekTo(target.value);
		// (document.querySelector('#current-time').textContent = secondsToHhMmSs(+target.value));
	}
}

function onCopy(event) {
	if (event.target.matches('TEXTAREA, input:not([type="range"])')) { return; }
	if (event.target.ownerDocument.getSelection().type === 'Range') { return; }
	const tile = event.target.ownerDocument.querySelector('[video-id]:hover'); if (tile) {
		const url = 'https://www.youtube.com/watch?v='+ tile.getAttribute('video-id');
		event.clipboardData.setData('text/plain', url);
		event.clipboardData.setData('text/uri-list', url);
		notify.success('Copied video URL', url);
	} else {
		event.clipboardData.setData('text/plain', Player.playlist.current.join('\n'));
		notify.success('Copied playlist', `The IDs of the current ${Player.playlist.length} videos were placed in the clipboard`);
	} event.preventDefault();
}

function onPaste(event) {
	if (event.target.matches('TEXTAREA, input:not([type="range"])')) { return; }
	importVideosFromText(event.clipboardData.getData('text'));
	event.preventDefault();
}

function onDrop(event) {
	event.preventDefault(); // never navigate
	if (!event.dataTransfer) { return; }
	if (event.dataTransfer.getData('<yTO-internal>')) { console.log('internal drop'); return; }
	importVideosFromText(event.dataTransfer.getData('text'));
}

function onDragover(event) {
	onDragover.x = event.clientX; onDragover.y = event.clientY;
	event.preventDefault(); // cause drop to fire
}

function highlight(element) {
	if (!element) { return; }

	scrollToCenter(element);

	element.animate([
		{ transform: 'translateX(-10px)', },
		{ transform: 'translateX( 10px)', },
	], {
		direction: 'alternate',
		easing: 'cubic-bezier(0, 0.3, 1, 0.7)',
		duration: 70,
		iterations: 8,
	});
	element.animate([
		{ filter: 'contrast(0.5)', },
		{ filter: 'contrast(2.0)', },
	], {
		direction: 'alternate',
		easing: 'cubic-bezier(0, 0.3, 1, 0.7)',
		duration: 140,
		iterations: 4,
	});
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
			Array.prototype.forEach.call(tiles.querySelectorAll('media-tile:not(.in-playlist)'), _=>_.remove()); // remove any inserted items
			const { x, y, } = onDragover, { top, left, bottom, right, } = tiles.getBoundingClientRect();
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

function scrollToCenter(element, { ifNeeded = true, duration = 250, } = { }) { return new Promise((resolve) => {
	// const scroller = element.offsetParent;
	const scroller = element.closest('.scroll-inner'); // firefox bug: .offsetParent is the closest element with a CSS filter.
	if (ifNeeded && element.offsetTop >= scroller.scrollTop && element.offsetTop + element.offsetHeight <= scroller.scrollTop + scroller.offsetHeight) { resolve(); return; }
	const to = Math.min(Math.max(0, element.offsetTop + element.offsetHeight / 2 - scroller.offsetHeight / 2), scroller.scrollHeight);
	if (!duration || element.closest('.no-transitions')) { scroller.scrollTop = to; resolve(); return; }
	const from = scroller.scrollTop, diff = to - from;

	const { requestAnimationFrame, performance, } = element.ownerDocument.defaultView;
	const start = performance.now(), end = start + duration;
	/// time in [start; end], coefficients from https://github.com/mietek/ease-tween/blob/master/src/index.js (MIT)
	const pos = time => from + diff * 1.0042954579734844 * Math.exp(-6.4041738958415664 * Math.exp(-7.2908241330981340 * (time - start) / duration));
	requestAnimationFrame(function step(now) {
		if (now >= end) { scroller.scrollTop = to; resolve(); }
		else { scroller.scrollTop = pos(now); requestAnimationFrame(step); }
	});
}); }

function positionInParent(element) {
	if (!element) { return -1; }
	return Array.prototype.indexOf.call(element.parentNode.children, element);
}

async function focusTab(videoId) {
	const frame = Player.frameFor(videoId);
	if (!frame) { return; }
	(await Tabs.update(frame.tabId, { active: true, }));
	const { windowId, } = (await Tabs.get(frame.tabId));
	(await Windows.update(windowId, { focused: true, }));
}

async function openTab(id) {
	const [ tab, ] = (await Tabs.query({ url: [ `https://www.youtube.com/watch?*v=${ id }*`, `https://gaming.youtube.com/watch?*v=${id}*`, ], }));
	if (!tab) { return Tabs.create({ url: 'https://www.youtube.com/watch?v='+ id, }); }
	(await Tabs.update(tab.id, { active: true, }));
	(await Windows.update(tab.windowId, { focused: true, }));
	return tab;
}

async function closeUnloadedTab(tile) {
	const id = tile.videoId;
	const tabs = (await Tabs.query({ url: [ `https://www.youtube.com/watch?*v=${ id }*`, `https://gaming.youtube.com/watch?*v=${id}*`, ], }));
	const exclude = Player.frameFor(id);
	const tab = tabs.find(tab => tab.id !== (exclude && exclude.tabId));
	if (!tab) { return; } (await Tabs.remove(tab.id)); tile.remove();
}

}); })(this);
