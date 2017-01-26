(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/string': { secondsToHhMmSs, },
	'node_modules/es6lib/functional': { fuzzyMatch, },
	'node_modules/sortablejs/Sortable.min': Sortable,
	'common/context-menu': ContextMenu,
}) => {
const browser = global.browser || global.chrome;
browser.tabs.getCurrent(tab => tab && (global.tabId = tab.id));

let defaultWindow, defaultTab, port, windowList, tabList, currentIndex = -1;

if (document.readyState !== 'interactive' && document.readyState !== 'complete') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

function init() {
	defaultWindow = document.querySelector('#window-default');
	defaultTab = document.querySelector('.tab-default');
	windowList = document.querySelector('#windows .windows');
	tabList = document.querySelector('#playlist .tabs');
	defaultWindow.remove(); defaultTab.remove();

	port = browser.runtime.connect({ name: 'panel', });
	port.emit = function(type, value) { this.postMessage({ type, value, }); };

	port.onMessage.addListener(({ type, value, }) => ({
		init({ windows, playlist, active, state, }) {
			console.log('init', windows, playlist, active, state);
			Object.keys(windows).forEach(windowId => {
				const win = windows[windowId];
				const tabList = windowList.appendChild(createWindow(win)).querySelector('.tabs');
				win.tabs.sort((a, b) => a.index - b.index).forEach(tab => tabList.appendChild(createTab(tab)));
				enableDragOut(tabList);
			});
			playlist.forEach(tabId => tabList.appendChild(windowList.querySelector('.tab-'+ tabId).cloneNode(true)).classList.add('in-playlist'));
			enableDragIn(tabList);
			this.playlist_seek(active);
			this.state_change(state);
			tabList.children[active] && (tabList.children[active].scrollIntoViewIfNeeded ? tabList.children[active].scrollIntoViewIfNeeded() : tabList.children[active].scrollIntoView());
			setTimeout(initCSS, 100);
		},
		state_change(state) {
			console.log('state_change', state);
			if ('playing' in state) {
				Array.prototype.forEach.call(document.querySelectorAll('#play, #pause'), button => button.classList.remove('active'));
				document.querySelector(state.playing ? '#play' : '#pause').classList.add('active');
			}
			if ('looping' in state) {
				document.querySelector('#loop').classList[state.looping ? 'add' : 'remove']('active');
			}
		},
		playlist_add({ index, tabId, reference, }) {
			console.log('playlist_add', index, tabId);
			if (reference && tabList.children[index] && tabList.children[index].reference === reference) { return; }
			tabList.insertBefore(windowList.querySelector('.tab-'+ tabId).cloneNode(true), tabList.children[index]).classList.add('in-playlist');
			reference && (tabList.children[index].reference = reference);
			seek(currentIndex);
		},
		playlist_push(tabIds) {
			console.log('playlist_push', ...tabIds);
			tabIds.forEach(tabId => tabList.appendChild(windowList.querySelector('.tab-'+ tabId).cloneNode(true)).classList.add('in-playlist'));
			seek(currentIndex);
		},
		playlist_seek(active) {
			console.log('playlist_seek', active);
			seek(currentIndex = active);
		},
		playlist_delete(index) {
			console.log('playlist_delete', index);
			removeTab(tabList.children[index]);
			seek(currentIndex);
		},
		playlist_clear() {
			console.log('playlist_clear');
			tabList.textContent = '';
		},
		playlist_replace(playlist) {
			console.log('playlist_replace', playlist);
			const active = positionInParent(tabList.querySelector('.active'));
			tabList.textContent = '';
			playlist.forEach(tabId => tabList.appendChild(windowList.querySelector('.tab-'+ tabId).cloneNode(true)));
			this.playlist_seek(active);
			tabList.children[active] && tabList.children[active].scrollIntoViewIfNeeded();
		},
		tab_open(tab) {
			console.log('tab_open', tab);
			let element = windowList.querySelector('.tab-'+ tab.tabId);
			if (element) {
				Array.prototype.forEach.call(document.querySelectorAll('.tab-'+ tab.tabId), element => updateTab(element, tab));
				removeTab(element);
			} else {
				element = createTab(tab);
			}
			const tabList = windowList.querySelector(`#window-${ tab.windowId } .tabs`) || windowList.appendChild(createWindow({ id: tab.windowId, title: tab.windowId, })).querySelector('.tabs');
			const next = Array.prototype.find.call(tabList.children, ({ dataset: { index, }, }) => index > tab.index); // TODO: the index of the other tabs in the list may be incorrect if they were shifted due to other tabs movement/open/close
			tabList.insertBefore(element, next);
		},
		tab_close(tabId) {
			console.log('tab_close', tabId);
			Array.prototype.forEach.call(document.querySelectorAll('.tab-'+ tabId), tab => removeTab(tab));
		},
	})[type](value));

	[ 'prev', 'play', 'pause', 'next', 'loop', ]
	.forEach(command => document.querySelector('#'+ command).addEventListener('click', ({ button, }) => !button && port.emit('command_'+ command)));

	document.querySelector('#more').addEventListener('click', ({ button, }) => {
		if (button) { return; }
		const { left: x, bottom: y, } = document.querySelector('#more').getBoundingClientRect();
		const url = new URL(location);
		const items = [
			browser.runtime.reload
			&&  { icon: '⚡',	label: 'Restart', action: () => confirm('Are you sure you want to restart this extension? It may take a while') && browser.runtime.reload(), },
			    { icon: '◑',	label: 'Dark Theme', checked: ('searchParams' in URL.prototype) && url.searchParams.get('theme') !== 'light', action() {
				    const theme = this.checked ? 'light' : 'dark';
				    url.searchParams.set('theme', theme);
				    history.replaceState(null, '', url);
				    document.documentElement.classList.add('no-transitions');
				    document.querySelector('#theme-style').href = `./theme/${ theme }.css`;/*`*/
				    setTimeout(() => document.documentElement.classList.remove('no-transitions'), 70);
				    port.emit('set_theme', theme);
			    }, },
			    { icon: '❐', 	label: 'Show in tab', action: () => browser.runtime.sendMessage([ 'openPlaylist', 0, [ ], ]), },
			    { icon: '◳', 	label: 'Open in popup', action: () => browser.windows.create({ url: location.href, type: 'popup', width: 450, height: 600, }), },
			    { icon: '⚙', 	label: 'Settings', action: () => browser.runtime.sendMessage([ 'openOptions', 0, [ ], ]), },
		];
		new ContextMenu({ x, y, items, });
	});
}

// show context menus
document.addEventListener('contextmenu', event => {
	const { target, clientX: x, clientY: y, } = event;
	if (!target.matches) { return; }
	const items = [ ];
	const tab = target.closest('.tab');
	const _window = target.closest('.window');
	const _playlist = target.matches('#playlist, #playlist *');
	if (target.matches('.tab, .tab *')) {
		const tabId = +tab.dataset.tabId;
		items.push(
			             { icon: '▶',	 label: 'Play video',       action: () => port.emit('tab_play',  tabId),    default: tab.matches('#playlist :not(.active)') && !target.matches('.remove, .icon'), },
			             { icon: '👁',	 label: 'Show tab',         action: () => port.emit('tab_focus', tabId),    default: tab.matches('#windows *, .active') && !target.matches('.remove, .icon'), },
			             { icon: '⨉',	 label: 'Close tab',        action: () => port.emit('tab_close', tabId),    default: target.matches('#windows .remove'), },
			_playlist && { icon: '❏',	 label: 'Duplicate',        action: () => port.emit('playlist_add', { index: positionInParent(tab), tabId, }), },
			_playlist && { icon: '⨉',	 label: 'Remove entry',     action: () => port.emit('playlist_delete', positionInParent(tab)), default: target.matches('#playlist .remove'), },
			_playlist && { icon: '🔍',	 label: 'Find in window',   action: () => highlight(windowList.querySelector('.tab-'+ tabId)), },
			_window   && { icon: '🔍',	 label: 'Find in playist',  action: () => highlight(tabList.querySelector('.tab-'+ tabId) || _window.querySelector('.tab-'+ tabId)), },
			_window   && { icon: '➕',	 label: 'Add video',        action: () => port.emit('playlist_push', [ tabId, ]), }
		);
	}
	if (_playlist) {
		items.push(
			{ icon: '⇵',	 label: 'Sort by',                      type: 'menu', children: [
				{ icon:'⌖',		 label: 'position',                     action: () => port.emit('playlist_sort', { by: 'position', }), },
				{ icon: '👓',	 label: 'views',                        type: 'menu', children: [
					{ icon: '🌐',	 label: 'global',                       action: () => port.emit('playlist_sort', { by: 'viewsGlobal', }), },
					{ icon: '⏱',	 label: 'yours in total duration',      action: () => port.emit('playlist_sort', { by: 'viewsDuration', }), },
					{ icon: '↻',	 label: 'yours in times viewed',        action: () => port.emit('playlist_sort', { by: 'viewsTimes', }), },
				], },
				{ icon: '🔀',	 label: 'Shuffle',                      action: () => port.emit('playlist_sort', { by: 'random', }), },
			], },
			{ icon: '🛇',	 label: 'Clear list',                   action: () => port.emit('playlist_clear'), }
		);
	}
	if (target.matches('.window .header .title')) {
		const box = windowList.querySelector('#'+ target.htmlFor);
		items.push(
			{ icon: '⇳',	 label: (box.checked ? 'Expand' : 'Collapse') +' tab list', action: () => (box.checked = !box.checked), default: true, }
		);
	}
	if (_window) {
		const windowId = _window.id.match(/^window-(.+)$/)[1];
		const tabCount = _window.querySelectorAll('.tab').length;
		tabCount > 1 && items.push(
			{ icon: '⋯',	 label: 'Add all '+ tabCount, action: () => port.emit('playlist_push', Array.prototype.map.call(_window.querySelectorAll('.tab'), _=>_.dataset.tabId)), },
			{ icon: '❌',	 label: 'Close all '+ tabCount, action: () => confirm('Close all '+ tabCount +' tabs in this window?') && port.emit('window_close', +windowId), }
		);
	}
	// ' 🔉 🔈 🔇 🔂 🔁 🔜 🌀 🔧 ⫶ 🔞 '; // some more icons

	if (!items.length) { return; }
	new ContextMenu({ x, y, items, });
	event.preventDefault();
});

// focus tab (windows) or play tab on dblclick
document.addEventListener('dblclick', ({ target, button, }) => {
	if (button || !target.matches || !target.matches('.description, .description :not(.remove)')) { return; }

	target = target.closest('.tab');
	if (target.matches('#playlist *')) {
		port.emit('playlist_seek', positionInParent(target));
	} else if (target.matches('#windows *')) {
		port.emit('tab_focus', +target.dataset.tabId);
	}
	window.getSelection().removeAllRanges();
});

// remove tab on leftcklick on ".remove"
document.addEventListener('click', ({ target, button, }) => {
	if (button || !target.matches) { return; }

	if (target.matches('.tab .remove, .tab .remove *')) {
		const tab = target.closest('.tab');
		if (tab.matches('#playlist *')) {
			port.emit('playlist_delete', positionInParent(tab));
		} else if (tab.matches('#windows *')) {
			port.emit('tab_close', +tab.dataset.tabId);
		}
	} else if (target.matches('#searchbox .remove, #searchbox .remove *')) {
		const box = document.querySelector('#searchbox>input');
		box.value = ''; box.blur();
		document.body.classList.remove('searching');
	}
});

document.addEventListener('keydown', event => {
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
			port.emit('command_toggle');
		} break;
		default: return;
	}
	event.preventDefault(); event.stopPropagation();
});

document.addEventListener('input', function handler(event) {
	if (event.target.matches('#searchbox>input')) {
		const term = event.target.value.trim();
		const lTerm = term.toLowerCase();
		const tabs = Array.from(document.body.querySelectorAll('.tab'));
		tabs.forEach(_=>_.classList.remove('found'));

		if (term.length < 3) { document.body.classList.remove('searching'); return; }
		else { document.body.classList.add('searching'); }

		// looking for trigrams makes it quite unlikely to match just anything, but a typo will have quite an impact
		const found = tabs.filter(tab => fuzzyIncludes(tab.querySelector('.icon').title.toLowerCase(), lTerm, 3) > 0.6);
		term.length === 11 && found.push(...tabs.filter(_=>_.dataset.videoId === term));
		found.forEach(_=>_.classList.add('found'));
	} else {
		return;
	}
});

function seek(active) {
	Array.prototype.forEach.call(tabList.querySelectorAll('.active'), tab => tab.classList.remove('active'));
	tabList.children[active] && tabList.children[active].classList.add('active');
}

function highlight(element) {
	if (!element) { return; }

	element.scrollIntoViewIfNeeded ? element.scrollIntoViewIfNeeded() : element.scrollIntoView({ behavior: 'smooth', });

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
			dataTransfer.setData('text', 'https://www.youtube.com/watch?v='+ item.dataset.videoId);
		},
	}));
}
function enableDragIn(element) {
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
			dataTransfer.setData('text', 'https://www.youtube.com/watch?v='+ item.dataset.videoId);
		},
		onAdd({ item, newIndex, }) { setTimeout(() => { // inserted, async for the :hover test
			if (!tabList.matches(':hover')) { // cursor is not over drop target ==> invalid drop
				Array.prototype.forEach.call(tabList.querySelectorAll('.tab:not(.in-playlist)'), _=>_.remove()); // remove any inserted items
				return;
			} else { // genuine drop
				const reference = item.reference || (item.reference = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36));
				Array.prototype.forEach.call(tabList.querySelectorAll('.tab:not(.in-playlist)'), _=>_.classList.add('in-playlist'));
				port.emit('playlist_add', { index: newIndex, tabId: +item.dataset.tabId, reference, });
				item.matches('.active') && port.emit('playlist_seek', newIndex);
			}
		}); },
		onUpdate({ item, newIndex, oldIndex, }) { // sorted within
			console.log('onUpdate');
			tabList.insertBefore(document.createElement('dummy'), tabList.children[oldIndex]); // will be removed in playlist_delete handler
			port.emit('playlist_delete', oldIndex);

			const reference = item.reference || (item.reference = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36));
			port.emit('playlist_add', { index: newIndex, tabId: +item.dataset.tabId, reference, });
			item.matches('.active') && port.emit('playlist_seek', newIndex);
		},
	}));
}

function createWindow(win) {
	return updateWindow(defaultWindow.cloneNode(true), win);
}

function updateWindow(element, { id, title, }) {
	element.id = 'window-'+ id;
	element.querySelector('label.toggleswitch').htmlFor = 'windowToggle-'+ id;
	element.querySelector('input.toggleswitch').id = 'windowToggle-'+ id;
	element.querySelector('.title').textContent = title || id;
	return element;
}

function createTab(tab) {
	return updateTab(defaultTab.cloneNode(true), tab);
}

function updateTab(element, tab) {
	if ('index' in tab) {
		element.dataset.index = tab.index;
	}
	if ('tabId' in tab) {
		element.dataset.tabId = tab.tabId;
		element.className = element.className.replace(/tab-[^ ]*/, 'tab-'+ tab.tabId);
	}
	if ('videoId' in tab) {
		element.dataset.videoId = tab.videoId;
		element.className = element.className.replace(/video-[^ ]*/, 'video-'+ tab.videoId);
	}
	if ('thumb' in tab) {
		element.querySelector('.icon').style.backgroundImage = `url(${ tab.thumb })`;
	}
	if ('title' in tab) {
		element.querySelector('.title').textContent = tab.title;
		element.querySelector('.icon').title = tab.title;
	}
	if ('duration' in tab) {
		const duration = secondsToHhMmSs(tab.duration);
		element.querySelector('.duration').textContent = duration;
	}
	return element;
}

function removeTab(tab) {
	tab.classList.contains('active') && tab.nextSibling && tab.nextSibling.classList.add('active');
	const window = tab.matches('.window *') && tab.closest('.window');
	window && window.querySelectorAll('.tab').length === 1 && window.remove();
	return tab.remove();
}

function positionInParent(element) {
	if (!element) { return -1; }
	return Array.prototype.indexOf.call(element.parentNode.children, element);
}

function fuzzyIncludes(s1, s2, n) {
	n = n > 2 && Number.parseInt(n) || 2;
	const l1 = s1.length - n + 1;
	const l2 = s2.length - n + 1;
	const ll = Math.min(l1, l2);
	const match = fuzzyMatch(s1, s2, n);
	return match && ll ? match / 2 * (l1 + l2) / ll : 0;
}

function initCSS() {
	// enable transitions
	setTimeout(() => document.documentElement.classList.remove('no-transitions'), 100);

	// hide scrollbars if ::-webkit-scrollbar doesn't apply
	const element = document.body.appendChild(document.createElement('div'));
	element.classList.add('scroll-inner');
	const width = element.offsetWidth - element.clientWidth;
	document.styleSheets[0].insertRule(`.scroll-inner { margin-right: -${ width }px; }`, 0);
	element.remove();
}

}); })(this);

!Element.prototype.matches && (Element.prototype.matches = Element.prototype.msMatchesSelector);
!Element.prototype.closest && (Element.prototype.closest = function getParent(selector) { 'use strict';
	let element = this;
	while (element && (!element.matches || !element.matches(selector))) { element = element.parentNode; }
	return element;
});

document.querySelector('#theme-style').href = `./theme/${ ('searchParams' in URL.prototype) && new URL(location).searchParams.get('theme') || 'dark' }.css`;
