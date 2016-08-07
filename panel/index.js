'use strict'; /* global Sortable */

const { secondsToHhMmSs, } = require('es6lib/format');
const ContextMenu = require('context-menu');

let defaultWindow, defaultTab, port, windowList, tabList;

window.addEventListener('DOMContentLoaded', () => {
	defaultWindow = document.querySelector('#window-default');
	defaultTab = document.querySelector('.tab-default');
	windowList = document.querySelector('#windows .windows');
	tabList = document.querySelector('#playlist .tabs');
	defaultWindow.remove(); defaultTab.remove();

	port = chrome.runtime.connect({ name: 'panel', });
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
			playlist.forEach(tabId => tabList.appendChild(windowList.querySelector('.tab-'+ tabId).cloneNode(true)));
			enableDragIn(tabList);
			this.playlist_seek(active);
			this.state_change(state);
			tabList.children[active] && (tabList.children[active].scrollIntoViewIfNeeded ? tabList.children[active].scrollIntoViewIfNeeded() : tabList.children[active].scrollIntoView());
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
			tabList.insertBefore(windowList.querySelector('.tab-'+ tabId).cloneNode(true), tabList.children[index]);
			reference && (tabList.children[index].reference = reference);
		},
		playlist_seek(active) {
			console.log('playlist_seek', active);
			Array.prototype.forEach.call(tabList.querySelectorAll('.active'), tab => tab.classList.remove('active'));
			tabList.children[active] && tabList.children[active].classList.add('active');
		},
		playlist_delete(index) {
			console.log('playlist_delete', index);
			removeTab(tabList.children[index]);
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
			const next = Array.prototype.find.call(tabList.children, ({ dataset: { index, }, }) => index > tab.index);
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
		const items = [
			chrome.runtime.reload && { label: 'Restart', action: () => chrome.runtime.reload(), },
			{ label: 'Settings', action: () => chrome.runtime.sendMessage({ name: 'showOptionsTab', args: [ '', ], }, () => window.close()), },
		];
		new ContextMenu({ x, y, items, });
	});

	hideScrollBars();
});

// focus tab (windows) or play tab on dblclick
document.addEventListener('dblclick', function({ target, button, }) {
	if (button || !target.matches || !target.matches('.description, .description :not(.remove)')) { return; }

	target = getParent(target, '.tab');
	if (target.matches('#playlist *')) {
		port.emit('playlist_seek', positionInParent(target));
	} else if (target.matches('#windows *')) {
		port.emit('tab_focus', +target.dataset.tabId);
	}
});

// remove tab on leftcklick on ".remove"
document.addEventListener('click', function({ target, button, }) {
	if (button || !target.matches || !target.matches('.tab .remove, .tab .remove *')) { return; }

	target = getParent(target, '.tab');
	if (target.matches('#playlist *')) {
		port.emit('playlist_delete', positionInParent(target));
	} else if (target.matches('#windows *')) {
		port.emit('tab_close', +target.dataset.tabId);
	}
});

// show context menus
document.addEventListener('contextmenu', function(event) {
	const { target, clientX: x, clientY: y, } = event;
	if (!target.matches) { return; }
	const items = [ ];
	if (target.matches('.tab, .tab *')) {
		const tab = getParent(target, '.tab');
		const tabId = +tab.dataset.tabId;
		items.push(
			{ label: 'Play video', action: () => port.emit('tab_play', tabId), default: target.matches('#playlist *') && !target.matches('.remove'), },
			{ label: 'Show tab', action: () => port.emit('tab_focus', tabId), default: target.matches('#windows *') && !target.matches('.remove'), },
			{ label: 'Close tab', action: () => port.emit('tab_close', tabId), default: target.matches('.remove'), },
			target.matches('#playlist *') && { label: 'Duplicate', action: () => port.emit('playlist_add', { index: positionInParent(tab), tabId, }), }
		);
	}
	if (target.matches('#playlist, #playlist *')) {
		items.push(
			{ label: 'Sort by', type: 'menu', children: [
				{ label: 'position', action: () => port.emit('playlist_sort', { by: 'position', }), },
				{ label: 'views', type: 'menu', children: [
					{ label: 'global', action: () => port.emit('playlist_sort', { by: 'viewsGlobal', }), },
					{ label: 'yours in total duration', action: () => port.emit('playlist_sort', { by: 'viewsTotal', }), },
					{ label: 'yours in times viewed', action: () => port.emit('playlist_sort', { by: 'viewsRelative', }), },
				], },
				{ label: 'Shuffle', action: () => port.emit('playlist_sort', { by: 'random', }), },
			], }
		);
	}
	if (target.matches('.window .header .title')) {
		const box = windowList.querySelector('#'+ target.htmlFor);
		items.push(
			{ label: (box.checked ? 'Expand' : 'Collapse') +' tab list', action: () => box.checked = !box.checked, default: true, }
		);
	}
	if (target.matches('#windows, #windows *')) {
		const windowId = getParent(target, '.window').id.match(/^window-(.+)$/)[1];
		items.push(
			{ label: 'Close window', action: () => confirm(
				'Close all '+ windowList.querySelectorAll('#window-'+ windowId +' .tab').length +' tabs in this window?'
			) && port.emit('window_close', +windowId), }
		);
	}

	if (!items.length) { return; }
	new ContextMenu({ x, y, items, });
	event.preventDefault();
});

function getParent(element, selector) {
	while (element && (!element.matches || !element.matches(selector))) { element = element.parentNode; }
	return element;
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
	}));
}
function enableDragIn(element) {
	return (element.sortable = new Sortable(element, {
		group: {
			name: 'playlist',
		},
		handle: '.icon',
		draggable: '.tab',
		ghostClass: 'ghost',
		animation: 500,
		scroll: true,
		scrollSensitivity: 90,
		scrollSpeed: 10,
		onSort({ newIndex, oldIndex, target, from, item, }) {
			if (newIndex === oldIndex && from === target) { return; }
			if (from === target) {
				tabList.insertBefore(document.createElement('dummy'), tabList.children[oldIndex]);
				port.emit('playlist_delete', oldIndex);
			}
			const reference = item.reference || (item.reference = Math.floor(Math.random() * 0xffFFffFF).toString(16));
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
		element.className = element.className.replace(/video-[^ ]*/, 'video-'+ tab.videoId);
	}
	if ('thumb' in tab) {
		element.querySelector('.icon').style.backgroundImage = `url(${ tab.thumb })`;
	}
	if ('title' in tab) {
		element.querySelector('.title').textContent = tab.title;
	}
	if ('duration' in tab) {
		const duration = typeof tab.duration === 'string' ? tab.duration : secondsToHhMmSs(tab.duration);
		element.querySelector('.duration').textContent = duration;
	}
	return element;
}

function removeTab(tab) {
	tab.classList.contains('active') && tab.nextSibling && tab.nextSibling.classList.add('active');
	const window = tab.matches('.window *') && getParent(tab, '.window');
	window && window.querySelectorAll('.tab').length === 1 && window.remove();
	return tab.remove();
}

function positionInParent(element) {
	if (!element) { return -1; }
	return Array.prototype.indexOf.call(element.parentNode.children, element);
}

function hideScrollBars() {
	const element = document.body.appendChild(document.createElement('div'));
	element.classList.add('scroll-inner');
	const width = element.offsetWidth - element.clientWidth;
	document.styleSheets[0].insertRule(`.scroll-inner { margin-right: -${ width }px; }`, 0);
	element.remove();
}
