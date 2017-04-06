(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/string': { secondsToHhMmSs, fuzzyIncludes, },
	'node_modules/es6lib/dom': { createElement, },
	'node_modules/sortablejs/Sortable.min': Sortable,
	'node_modules/web-ext-utils/browser/': { manifest, runtime, Tabs, Windows, },
	'node_modules/web-ext-utils/utils/': { showExtensionTab, reportError, },
	'background/commands': commands,
	'background/db': db,
	'background/playlist': playlist,
	'background/tab': { actives: players, onOpen, onClose, onPlay, },
	'common/context-menu': ContextMenu,
	'common/options': options,
	'./body.html': Body,
	require,
}) => {

async function View(window) {
	const { document, } = window;
	const off = { owner: window, };

	View.instances.push(window);
	window.addEventListener('unload', () => View.instances.splice(View.instances.indexOf(window), 1));

	document.title = manifest.name +' - Playlist';

	const theme = document.head.appendChild(createElement('link', { rel: 'stylesheet', }));
	options.playlist.children.theme.whenChange(value => (theme.href = require.toUrl(`./theme/${ value }.css`)), off);
	document.head.appendChild(createElement('link', { rel: 'stylesheet', href: require.toUrl(`./layout.css`), }));
	document.head.appendChild(createElement('link', { rel: 'stylesheet', href: `/common/context-menu.css`, }));

	document.body.lang = global.navigator.language;
	document.body.innerHTML = Body;
	document.body.classList = 'no-transitions loading';
	global.setTimeout(() => document.documentElement.classList.remove('no-transitions'), 200);

	const windowList = document.querySelector('#windows .windows');
	const tabList = document.querySelector('#playlist .tabs');
	const defaultWindow = document.querySelector('#window-default');
	const defaultTab = document.querySelector('.tab[data-tab="default"');
	defaultWindow.remove(); defaultTab.remove();

	const tabs = (await Promise.all(Array.from(players.values(), tab => tab.tab().catch(error => (console.error(error), tab)))));
	const windows = { }; tabs.forEach(tab => {
		!windows[tab.windowId] && (windows[tab.windowId] = { id: tab.windowId, tabs: [ ], });
		windows[tab.windowId].tabs.push(tab);
	});

	document.body.classList.remove('loading');
	Object.values(windows).forEach(window => {
		const tabList = windowList.appendChild(updateWindow(defaultWindow.cloneNode(true), window)).querySelector('.tabs');
		window.tabs.sort((a, b) => a.index - b.index).forEach(tab => tabList.appendChild(updateTab(defaultTab.cloneNode(true), tab)));
		enableDragOut(tabList);
	});
	playlist.forEach(tab => tabList.appendChild(windowList.querySelector(`.tab[data-tab="${ tab.tabId }"]`).cloneNode(true)).classList.add('in-playlist'));
	enableDragIn(tabList);

	playlist.onSeek.addListener(seek, off); seek(playlist.index);
	function seek(active) {
		Array.prototype.forEach.call(tabList.querySelectorAll('.active'), tab => tab.classList.remove('active'));
		if (!tabList.children[active]) { return; }
		tabList.children[active].classList.add('active');
		if (tabList.matches(':hover')) { return; }
		scrollToCenter(tabList.children[active]);
	}

	options.playlist.children.loop.whenChange(value => document.querySelector('#loop').classList[value ? 'add' : 'remove']('active'), off);

	onPlay.addListener(playing, off); playlist.is(_=>_.playing) && playing(true);
	function playing(playing) {
		document.querySelector( playing ? '#play' : '#pause').classList.add('active');
		document.querySelector(!playing ? '#play' : '#pause').classList.remove('active');
	}

	playlist.onAdd.addListener(async (index, tab) => {
		const other = windowList.querySelector(`.tab[data-tab="${ tab.tabId }"]`);
		const self = /*other ?*/ other.cloneNode(true) /*: updateTab(defaultTab.cloneNode(true), tab)*/;
		tabList.insertBefore(self, tabList.children[index]).classList.add('in-playlist');
	}, off);

	playlist.onRemove.addListener((index, tab) => {
		if (tabList.children[index].dataset.tab !== tab.id +'') { throw new Error; }
		removeTabElement(tabList.children[index]);
	}, off);

	onOpen.addListener(tab => {
		let element = windowList.querySelector(`.tab[data-tab="${ tab.tabId }"]`);
		if (!element) { element = updateTab(defaultTab.cloneNode(true), tab); }
		else { document.querySelectorAll(`.tab[data-tab="${ tab.tabId }"]`).forEach(element => updateTab(element, tab)); }
		const tabList = windowList.querySelector(`#window-${ tab.windowId } .tabs`)
		|| windowList.appendChild(updateWindow(defaultWindow.cloneNode(true), { id: tab.windowId, title: tab.windowId, })).querySelector('.tabs');
		const next = Array.prototype.find.call(tabList.children, ({ dataset: { index, }, }) => index > tab.index); // TODO: the index of the other tabs in the list may be incorrect if they were shifted due to other tabs movement/open/close
		tabList.insertBefore(element, next);
	}, off);

	onClose.addListener(tabId => {
		document.querySelectorAll(`.tab[data-tab="${ tabId }"]`).forEach(tab => removeTabElement(tab));
	}, off);

	[ 'prev', 'play', 'pause', 'next', 'loop', ]
	.forEach(command => document.querySelector('#'+ command).addEventListener('click', ({ button, }) => !button && commands[command]()));

	document.querySelector('#more').addEventListener('click', showMainMenu);
	document.addEventListener('contextmenu', showContextMenu);
	document.addEventListener('dblclick', onDblckick);
	document.addEventListener('click', onClick);
	document.addEventListener('keydown', onKeydown);
	document.addEventListener('input', onInput);
}
View.instances = [ ];
return View;

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
	const document = event.target.ownerDocument, window = document.defaultView;
	const windowList = document.querySelector('#windows .windows');
	const tabList = document.querySelector('#playlist .tabs');
	const items = [ ];
	const tab = target.closest('.tab');
	const _window = target.closest('.window');
	const _playlist = target.matches('#playlist, #playlist *');
	if (target.matches('.tab, .tab *')) {
		const tabId = +tab.dataset.tab;
		items.push(
			             { icon: '▶',	 label: 'Play video',       action: () => players.get(+tabId).play(),   default: tab.matches('#playlist :not(.active)') && !target.matches('.remove, .icon'), },
			             { icon: '👁',	 label: 'Show tab',         action: () => focusTab(+tabId),          default: tab.matches('#windows *, .active') && !target.matches('.remove, .icon'), },
			             { icon: '⨉',	 label: 'Close tab',        action: () => Tabs.remove(tabId),        default: target.matches('#windows .remove'), },
			_playlist && { icon: '❏',	 label: 'Duplicate',        action: () => playlist.splice(positionInParent(tab), 0, players.get(+tabId)), },
			_playlist && { icon: '⨉',	 label: 'Remove entry',     action: () => playlist.splice(positionInParent(tab), 1), default: target.matches('#playlist .remove'), },
			_playlist && { icon: '🔍',	 label: 'Find in window',   action: () => highlight(windowList.querySelector(`.tab[data-tab="${ tabId }"]`)), },
			_window   && { icon: '🔍',	 label: 'Find in playist',  action: () => highlight(tabList.querySelector(`.tab[data-tab="${ tabId }"]`) || _window.querySelector(`.tab[data-tab="${ tabId }"]`)), },
			_window   && { icon: '➕',	 label: 'Add video',        action: () => playlist.push(players.get(+tabId)), }
		);
	}
	if (_playlist) {
		items.push(
			{ icon: '⇵',	 label: 'Sort by',                      type: 'menu', children: [
				{ icon:'⌖',		 label: 'position',                     action: () => sortPlaylist('position'), },
				{ icon: '👓',	 label: 'views',                        type: 'menu', children: [
					{ icon: '🌐',	 label: 'global',                       action: () => sortPlaylist('viewsGlobal'), },
					{ icon: '⏱',	 label: 'yours in total duration',      action: () => sortPlaylist('viewsDuration'), },
					{ icon: '↻',	 label: 'yours in times viewed',        action: () => sortPlaylist('viewsTimes'), },
				], },
				{ icon: '🔀',	 label: 'Shuffle',                      action: () => sortPlaylist('random'), },
			], },
			{ icon: '🛇',	 label: 'Clear list',                   action: () => playlist.splice(0, Infinity) === commands.pause(), }
		);
	}
	if (target.matches('.window .header .title')) {
		const box = windowList.querySelector('#'+ target.htmlFor);
		items.push(
			{ icon: '⇳',	 label: (box.checked ? 'Expand' : 'Collapse') +' tab list', action: () => (box.checked = !box.checked), default: true, }
		);
	}
	if (_window) {
		const _tabs = Array.from(_window.querySelectorAll(document.body.classList.contains('searching') ? '.tab.found' : '.tab'));
		_tabs.length > 1 && items.push(
			{ icon: '⋯',	 label: 'Add all '+   _tabs.length, action: () => playlist.push(..._tabs.map(tab => players.get(+tab.dataset.tab))), },
			{ icon: '❌',	 label: 'Close all '+ _tabs.length, action: () => {
				window.confirm('Close all '+ _tabs.length +' tabs in this window?') && _tabs.forEach(tab => Tabs.remove(+tab.dataset.tab));
			}, }
		);
	}
	// ' 🔉 🔈 🔇 🔂 🔁 🔜 🌀 🔧 ⫶ 🔞 '; // some more icons

	if (!items.length) { return; }
	new ContextMenu({ x, y, items, host: document.body, });
	event.preventDefault();
}

// focus tab (windows) or play tab on dblclick
function onDblckick({ target, button, }) {
	if (button || !target.matches || !target.matches('.description, .description :not(.remove)')) { return; }
	const document = target.ownerDocument;

	target = target.closest('.tab');
	if (target.matches('#playlist *')) {
		if (target.matches('.active')) {
			focusTab(+target.dataset.tab);
		} else {
			const playing = playlist.is(_=>_.playing);
			playlist.index = positionInParent(target);
			playing && playlist.is(_=>_.play());
		}
	} else if (target.matches('#windows *')) {
		focusTab(+target.dataset.tab);
	}
	document.defaultView.getSelection().removeAllRanges();
}

// remove tab on leftcklick on ".remove"
function onClick({ target, button, }) {
	if (button || !target.matches) { return; }
	const document = target.ownerDocument;

	if (target.matches('.tab .remove, .tab .remove *')) {
		const tab = target.closest('.tab');
		if (tab.matches('#playlist *')) {
			playlist.splice(positionInParent(tab), 1);
		} else if (tab.matches('#windows *')) {
			Tabs.remove(+tab.dataset.tab);
		}
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
		case 'Escape': {
			if (event.ctrlKey || !event.target.matches('#searchbox>input')) { return; }
			event.target.value = ''; event.target.blur();
			document.body.classList.remove('searching');
		} break;
		case ' ': {
			if (inInput) { return; }
			commands.toggle();
		} break;
		default: return;
	}
	event.preventDefault(); event.stopPropagation();
}

function onInput(event) {
	const document = event.target.ownerDocument;
	if (event.target.matches('#searchbox>input')) {
		const windowList = document.querySelector('#windows .windows');
		const term = event.target.value.trim();
		const lTerm = term.toLowerCase();
		const tabs = Array.from(windowList.querySelectorAll('.tab'));
		tabs.forEach(_=>_.classList.remove('found'));

		if (term.length < 3) { document.body.classList.remove('searching'); return; }
		else { document.body.classList.add('searching'); }

		// looking for trigrams makes it quite unlikely to match just anything, but a typo will have quite an impact
		const found = tabs.filter(tab => fuzzyIncludes(tab.querySelector('.icon').title.toLowerCase(), lTerm, 3) > 0.6);
		term.length === 11 && found.push(...tabs.filter(_=>_.dataset.video === term));
		found.forEach(_=>_.classList.add('found'));
	} else {
		return;
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
function enableDragOut(element) {
	return (element.sortable = new Sortable(element, {
		group: {
			name: 'playlist',
			pull: 'clone',
			put: false,
		},
		handle: '.icon',
		draggable: '.tab',
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
function enableDragIn(element) {
	const document = element.ownerDocument;
	const tabList = document.querySelector('#playlist .tabs');
	return (element.sortable = new Sortable(element, {
		group: {
			name: 'playlist',
			pull: false,
			put: true,
		},
		handle: '.icon',
		draggable: '.tab',
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
			Array.prototype.forEach.call(tabList.querySelectorAll('.tab:not(.in-playlist)'), _=>_.remove()); // remove any inserted items
			if (!tabList.matches(':hover')) { return; } // cursor is not over drop target ==> invalid drop
			playlist.splice(newIndex, 0, players.get(+item.dataset.tab));
		}); },
		onUpdate({ item, newIndex, oldIndex, }) { // sorted within
			console.log('onUpdate');
			item.remove(); tabList.insertBefore(item, tabList.children[oldIndex]); // put back to old position
			playlist.splice(oldIndex, 1);
			playlist.splice(newIndex, 0, players.get(+item.dataset.tab));
			item.matches('.active') && (playlist.index = newIndex);
		},
	}));
}

function updateWindow(element, { id, title, }) {
	element.id = 'window-'+ id;
	element.querySelector('label.toggleswitch').htmlFor = 'windowToggle-'+ id;
	element.querySelector('input.toggleswitch').id = 'windowToggle-'+ id;
	element.querySelector('.title').textContent = title || id;
	return element;
}

function updateTab(element, tab) {
	element.dataset.tab = tab.tabId;
	element.dataset.video = tab.videoId;
	const icon = element.querySelector('.icon');
	icon.style.backgroundImage = `url(${ tab.thumbUrl })`;
	icon.title = tab.title;
	element.querySelector('.title').textContent = tab.title;
	const duration = secondsToHhMmSs(tab.duration);
	element.querySelector('.duration').textContent = duration;
	return element;
}

function removeTabElement(tab) {
	tab.classList.contains('active') && tab.nextSibling && tab.nextSibling.classList.add('active');
	const window = tab.matches('.window *') && tab.closest('.window');
	window && window.querySelectorAll('.tab').length === 1 && window.remove();
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

async function focusTab(tabId) {
	(await Tabs.update(tabId, { active: true, }));
	const { windowId, } = (await Tabs.get(tabId));
	(await Windows.update(windowId, { focused: true, }));
}

async function sortPlaylist(by, direction = 0) { try {
	const directed = !!(direction << 0);
	direction = directed && direction < 0 ? -1 : 1;
	console.log('playlist_sort', by, direction, directed);
	const mapper = { // must return a signed 32-bit integer
		random:        _   => Math.random() * 0xffffffff,
		position:      tab => tab.tab().then(info => (info.windowId << 16) + info.index),
		viewsGlobal:   tab => db.get(tab.videoId, [ 'rating', ]).then(({ rating, }) => -rating.views),
		viewsDuration: tab => db.get(tab.videoId, [ 'viewed', ]).then(({ viewed, }) => -(viewed || 0) * 256),
		viewsTimes:    tab => db.get(tab.videoId, [ 'viewed', 'meta', ]).then(({ viewed, meta, }) => -(viewed || 0) / (meta && meta.duration || Infinity) * 256),
	}[by];
	const data = new WeakMap; // Tab ==> number
	(await Promise.all(playlist.map(
		(tab, index) => Promise.resolve(tab).then(mapper)
		.catch(error => (console.error(error), 0))
		.then(value => data.set(tab, (value << 0) || 0) * 1024 + index) // add the previous index to make the sorting stable
	)));
	const current = playlist.get();
	const sorted = playlist.slice().sort((a, b) => (data.get(a) - data.get(b)) * direction); // sort a .slice() to avoid updates
	const reverse = !directed && playlist.every((tab, index) => tab === sorted[index]); // reverse if nothing changed
	playlist.splice(0, Infinity, ...(reverse ? sorted.reverse() : sorted)); // write change
	playlist.index = playlist.indexOf(current);
} catch(error) { reportError('Sorting failed', error); } }

}); })(this);
