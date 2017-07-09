(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/string': { fuzzyIncludes, secondsToHhMmSs, },
	'node_modules/es6lib/dom': { createElement, },
	'node_modules/sortablejs/Sortable.min': Sortable,
	'node_modules/web-ext-utils/browser/': { manifest, runtime, Tabs, Windows, },
	'node_modules/web-ext-utils/utils/': { showExtensionTab, reportError, },
	'background/player': Player,
	'background/video-info': { makeTileClass, },
	'common/context-menu': ContextMenu,
	'common/options': options,
	'fetch!./body.html': Body,
	require,
}) => {

return async function View(window) {

	const { document, } = window;
	const off = { owner: window, };
	const Tile = window.Tile = makeTileClass(window);

	document.title = 'Playlist - '+ manifest.name;
	const theme = document.head.appendChild(createElement('link', { rel: 'stylesheet', }));
	options.playlist.children.theme.whenChange(value => (theme.href = require.toUrl(`./theme/${ value }.css`)), off);
	document.head.appendChild(createElement('link', { rel: 'stylesheet', href: require.toUrl(`./layout.css`), }));
	document.head.appendChild(createElement('link', { rel: 'stylesheet', href: `/common/context-menu.css`, }));

	document.body.lang = global.navigator.language;
	document.body.innerHTML = Body;
	document.body.classList = 'no-transitions loading';
	document.body.classList.remove('loading'); // TODO: remove CSS
	global.setTimeout(() => document.body.classList.remove('no-transitions'), 200);

	const groupList = document.querySelector('#groups .groups');
	const playlistTiles = document.querySelector('#playlist .tiles');

	{ // videos open in tabs
		const ids = (await Player.getOpenVideos());
		const group = groupList.appendChild(createGroup('tabs', 'Open Tabs'));
		const tiles = group.querySelector('.tiles');
		enableDragOut(tiles);
		const addTile = id => tiles.appendChild(Object.assign(new Tile, { videoId: id, }));
		ids.forEach(addTile);

		Player.onVideoOpen(addTile, off);
		Player.onVideoClose(id => tiles.querySelector(`media-tile[video-id="${ id }"]`).remove(), off);
	}

	{ // playlist
		const ids = Player.playlist.current;
		const tiles = playlistTiles;
		enableDragIn(tiles);
		const createTile = id => { const tile = new Tile; tile.videoId = id; tile.classList.add('in-playlist'); return tile; };
		ids.forEach(id => tiles.appendChild(createTile(id)));

		Player.playlist.onAdd((index, id) => tiles.insertBefore(createTile(id), tiles.children[index]), off);
		Player.playlist.onRemove(index => removeTile(tiles.children[index]), off);

		Player.playlist.onSeek(seek, off); seek(Player.playlist.index);
		function seek(index) {
			tiles.querySelectorAll('.active').forEach(tab => tab.classList.remove('active'));
			if (!tiles.children[index]) { return; }
			tiles.children[index].classList.add('active');
			if (tiles.matches(':hover')) { return; }
			scrollToCenter(tiles.children[index]);
		}
	}

	{ // controls
		options.playlist.children.loop.whenChange(([ value, ]) => document.querySelector('#loop').classList[value ? 'add' : 'remove']('active'), off);
		Player.onPlay(playing, off); Player.playing && playing(true);
		function playing(playing) {
			document.querySelector( playing ? '#play' : '#pause').classList.add('active');
			document.querySelector(!playing ? '#play' : '#pause').classList.remove('active');
		}
	}
	{ // seek-bar
		let looping = false, lastSec = -1;
		const progress = document.querySelector('#progress>input'), time = document.querySelector('#current-time');
		const next = window.requestAnimationFrame;
		Player.onPlay(check, off); Player.onDurationChange(check, off); check();
		async function check() { if (!Player.duration) { // stop & hide
			document.querySelector('#seek-bar').classList.add('hidden');
			looping = false;
		} else if (Player.playing) { // start & show
			if (!looping) { looping = true; loop(); }
			document.querySelector('#seek-bar').classList.remove('hidden');
			document.querySelector('#total-time').textContent = secondsToHhMmSs(Player.duration);
			progress.max = Player.duration;
		} else { // stop
			looping = false;
		} }
		function loop() {
			const current = Player.currentTime;
			progress.value = current;
			const sec = current <<0;
			sec !== lastSec && (time.textContent = secondsToHhMmSs((lastSec = sec)));
			looping && next(loop);
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
};

function showMainMenu(event) {
	if (event.button) { return; }
	const document = event.target.ownerDocument, window = document.defaultView;
	const { left: x, bottom: y, } = document.querySelector('#more').getBoundingClientRect();
	const items = [
		runtime.reload
		&&  { icon: '⚡',	label: 'Restart', action: () => window.confirm(`Restart ${ manifest.name }?`) && runtime.reload(), },
		    { icon: '◑',	label: 'Dark Theme', checked: options.playlist.children.theme.value === 'dark', action() {
			    const theme = this.checked ? 'light' : 'dark';
			    document.body.classList.add('no-transitions');
			    global.setTimeout(() => document.body.classList.remove('no-transitions'), 70);
			    options.playlist.children.theme.value = theme;
		    }, },
		    { icon: '❐', 	label: 'Show in tab', action: () => showExtensionTab('/view.html#playlist'), },
		    { icon: '◳', 	label: 'Open in popup', action: () => Windows.create({ url: document.defaultView.location.href, type: 'popup', width: 450, height: 600, }), },
		    { icon: '⚙', 	label: 'Settings', action: () => showExtensionTab('/view.html#options'), },
	];
	new ContextMenu({ x, y, items, host: document.body, });
}

// show context menus
function showContextMenu(event) {
	const { target, clientX: x, clientY: y, } = event;
	if (!target.matches) { return; }
	const document = event.target.ownerDocument;
	const others = document.querySelector('#groups');
	const playlist = document.querySelector('#playlist .tiles');
	const items = [ ];
	const tile = target.closest('media-tile');
	const group = target.closest('.group');
	const inList = target.matches('#playlist, #playlist *');
	if (tile) {
		const id = tile.videoId;
		const hasTab = Player.frameFor(id);
		items.push(
			           { icon: '▶',		label: 'Play video',       action: () => { Player.current = id; Player.play(); }, default: tile.matches('#playlist :not(.active)') && !target.matches('.remove, .icon'), },
			 hasTab && { icon: '👁',	label: 'Show tab',         action: () => { focusTab(id); }, default: tile.matches('#group-tabs *, .active') && !target.matches('.remove, .icon'), },
			!hasTab && { icon: '◳',		label: 'Open in tab',      action: () => { Tabs.create({ url: 'https://www.youtube.com/watch?v='+ id, }); }, },
			 inList && { icon: '❏',		label: 'Duplicate',        action: () => Player.playlist.splice(positionInParent(tile), 0, id), },
			 inList && { icon: '⨉',		label: 'Remove entry',     action: () => Player.playlist.splice(positionInParent(tile), 1), default: target.matches('#playlist .remove'), },
			 inList && { icon: '🔍',	label: 'Highlight',        action: () => highlight(others.querySelector(`media-tile[video-id="${ id }"]`)), },
			!inList && { icon: '🔍',	label: 'Highlight',        action: () => highlight(playlist.querySelector(`media-tile[video-id="${ id }"]`)), },
			!inList && { icon: '➕',	label: 'Add video',        action: () => Player.playlist.splice(Infinity, 0, id), },
		);
	}
	if (inList) {
		items.push(
			{ icon: '⇵',	 label: 'Sort by',                      type: 'menu', children: [
				{ icon:'⌖',		 label: 'position',                     action: () => Player.playlist.sort('position').catch(reportError.bind(null, 'Sorting failed')), },
				{ icon: '👓',	 label: 'views',                        type: 'menu', children: [
					{ icon: '🌐',	 label: 'global',                       action: () => Player.playlist.sort('viewsGlobal').catch(reportError.bind(null, 'Sorting failed')), },
					{ icon: '⏱',	 label: 'yours in total duration',      action: () => Player.playlist.sort('viewsDuration').catch(reportError.bind(null, 'Sorting failed')), },
					{ icon: '↻',	 label: 'yours in times viewed',        action: () => Player.playlist.sort('viewsTimes').catch(reportError.bind(null, 'Sorting failed')), },
				], },
				{ icon: '🔀',	 label: 'Shuffle',                      action: () => Player.playlist.sort('random').catch(reportError.bind(null, 'Sorting failed')), },
			], },
			{ icon: '🛇',	 label: 'Clear list',                   action: () => Player.playlist.splice(0, Infinity), },
		);
	}
	if (target.matches('.group .header .title')) {
		const box = document.querySelector('#'+ target.htmlFor);
		items.push(
			{ icon: '⇳',	 label: (box.checked ? 'Expand' : 'Collapse') +' tab list', action: () => (box.checked = !box.checked), default: true, }
		);
	}
	if (group) {
		const tiles = Array.from(others.querySelectorAll(document.body.classList.contains('searching') ? 'media-tile.found' : 'media-tile'));
		tiles.length > 1 && items.push(
			{ icon: '⋯',	 label: 'Add all '+   tiles.length, action: () => Player.playlist.splice(0, Infinity, ...tiles.map(_=>_.videoId)), },
		);
	}
	// ' 🔉 🔈 🔇 🔂 🔁 🔜 🌀 🔧 ⫶ 🔞 '; // some more icons

	if (!items.length) { return; }
	new ContextMenu({ x, y, items, host: document.body, });
	event.preventDefault();
}

// focus tab (windows) or play tab on dblclick
function onDblckick({ target, button, }) {
	if (button || !target.matches) { return; }
	const document = target.ownerDocument;

	const tile = target.closest('media-tile');
	if (!tile) { return; }
	if (tile.matches('#playlist *')) {
		if (tile.matches('.active')) {
			focusTab(tile.videoId);
		} else {
			Player.playlist.index = positionInParent(tile);
		}
	} else {
		focusTab(tile.videoId);
	}
	document.defaultView.getSelection().removeAllRanges();
}

// remove tab on leftcklick on ".remove"
function onClick({ target, button, }) {
	if (button || !target.matches) { return; }
	const document = target.ownerDocument;

	if (target.matches('#playlist media-tile .remove, #playlist media-tile .remove *')) {
		const tile = target.closest('media-tile');
		Player.playlist.splice(positionInParent(tile), 1);
	} else if (target.matches('#searchbox .remove, #searchbox .remove *')) {
		const box = document.querySelector('#searchbox>input');
		box.value = ''; box.blur();
		document.body.classList.remove('searching');
	}
}

function onKeydown(event) {
	const document = event.target.ownerDocument;
	const inInput = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
	switch (event.key) {
		case 'f': {
			if (!event.ctrlKey) { return; }
			const box = document.querySelector('#searchbox>input');
			box.focus(); box.select();
		} break;
		case 'o': {
			if (!event.ctrlKey) { return; }
			const reply = document.defaultView.prompt('Paste a comma or space separated list of YouTube video IDs below:');
			const ids = reply.trim().split(/[\s,;]+/g).map(string => { switch (true) {
				case (/^[\w-]{11}$/).test(string): return string;
			} return null; }).filter(_=>_);
			Player.playlist.splice(Infinity, 0, ...ids);
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
}

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
		term.length === 11 && found.push(...tiles.filter(_=>_.dataset.video === term));
		found.forEach(_=>_.classList.add('found'));
	} else if (target.matches('#progress>input')) {
		Player.seekTo(target.value);
	}
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
		setData(dataTransfer, item) { // insert url if dropped somewhere else
			dataTransfer.setData('text', 'https://www.youtube.com/watch?v='+ item.dataset.video);
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
		setData(dataTransfer, item) { // insert url if dropped somewhere else
			dataTransfer.setData('text', 'https://www.youtube.com/watch?v='+ item.dataset.video);
		},
		onAdd({ item, newIndex, }) { global.setTimeout(() => { // inserted, async for the :hover test
			Array.prototype.forEach.call(tiles.querySelectorAll('media-tile:not(.in-playlist)'), _=>_.remove()); // remove any inserted items
			if (!tiles.matches(':hover')) { return; } // cursor is not over drop target ==> invalid drop
			Player.playlist.splice(newIndex, 0, item.videoId);
		}); },
		onUpdate({ item, newIndex, oldIndex, }) { // sorted within
			console.log('onUpdate');
			item.remove(); tiles.insertBefore(item, tiles.children[oldIndex]); // put back to old position
			Player.playlist.splice(oldIndex, 1);
			Player.playlist.splice(newIndex, 0, item.videoId);
			item.matches('.active') && (Player.playlist.index = newIndex);
		},
	}));
}

function createGroup(id, name) { return createElement('div', { id: 'group-'+ id, className: 'group', }, [
	createElement('div', { className: 'header', }, [
		createElement('label', { className: 'toggleswitch title', htmlFor: 'groupToggle-'+ id, }, [ name, ]),
	]),
	createElement('input', { className: 'toggleswitch', type: 'checkbox', id: 'groupToggle-'+ id, }),
	createElement('span', { className: 'tiles', }),
]); }

function removeTile(tab) {
	tab.classList.contains('active') && tab.nextSibling && tab.nextSibling.classList.add('active');
	return tab.remove();
}

function scrollToCenter(element, { ifNeeded = true, duration = 250, } = { }) { return new Promise((resolve) => {
	// const scroller = element.offsetParent;
	const scroller = element.closest('.scroll-inner'); // firefox bug: .offsetParent is the closest element with a CSS filter.
	if (ifNeeded && element.offsetTop >= scroller.scrollTop && element.offsetTop + element.offsetHeight <= scroller.scrollTop + scroller.offsetHeight) { return void resolve(); }
	const to = Math.min(Math.max(0, element.offsetTop + element.offsetHeight / 2 - scroller.offsetHeight / 2), scroller.scrollHeight);
	if (!duration) { scroller.scrollTop = to; return void resolve(); }
	const from = scroller.scrollTop, diff = to - from;

	const { requestAnimationFrame, performance, } = element.ownerDocument.defaultView;
	const start = performance.now(), end = start + duration;
	/// time in [start; end], coefficients from https://github.com/mietek/ease-tween/blob/master/src/index.js (MIT)
	const pos = time => from + diff * 1.0042954579734844 * Math.exp(-6.4041738958415664 * Math.exp(-7.2908241330981340 * (time - start) / duration));
	requestAnimationFrame(function step(now) {
		if (now >= end) { scroller.scrollTop = to; return void resolve(); }
		scroller.scrollTop = pos(now);
		requestAnimationFrame(step);
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

}); })(this);
