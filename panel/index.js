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
			tabList.children[active] && tabList.children[active].scrollIntoViewIfNeeded();
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
		playlist_add({ index, tabId, }) {
			console.log('playlist_add', index, tabId);
			tabList.insertBefore(windowList.querySelector('.tab-'+ tabId).cloneNode(true), tabList.children[index]);
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
			const active = Array.prototype.indexOf.call(tabList.children, tabList.querySelector('.active'));
			tabList.textContent = '';
			playlist.forEach(tabId => tabList.appendChild(windowList.querySelector('.tab-'+ tabId).cloneNode(true)));
			this.playlist_seek(active);
			tabList.children[active] && tabList.children[active].scrollIntoViewIfNeeded();
		},
		tab_open(tab) {
			console.log('tab_open', tab);
			if (document.querySelector('.tab-'+ tab.tabId)) { return this.tab_update(tab); }
			const tabList = windowList.querySelector(`#window-${ tab.windowId } .tabs`) || windowList.appendChild(createWindow({ id: tab.windowId, title: tab.windowId, })).querySelector('.tabs');
			const next = Array.prototype.find.call(tabList.children, ({ dataset: { index, }, }) => index > tab.index);
			tabList.insertBefore(createTab(tab), next);
		},
		tab_update(tab) {
			console.log('tab_update', tab);
			if ('tabId' in tab) {
				Array.prototype.forEach.call(document.querySelectorAll('.tab-'+ tab.tabId), element => updateTab(element, tab));
			} else if ('videoId' in tab) {
				Array.prototype.forEach.call(document.querySelectorAll('.video-'+ tab.videoId), element => updateTab(element, tab));
			}
		},
		tab_close(tabId) {
			console.log('tab_close', tabId);
			Array.prototype.forEach.call(document.querySelectorAll('.tab-'+ tabId), tab => removeTab(tab));
		},
	})[type](value));

	[ 'prev', 'play', 'pause', 'next', 'loop', ]
	.forEach(command => document.querySelector('#'+ command).addEventListener('click', ({ button, }) => !button && port.emit('command_'+ command)));
});

// focus tab (windows) or play tab on dblclick
document.addEventListener('dblclick', function({ target, button, }) {
	if (button || !target.matches || !target.matches('.description, .description :not(.remove)')) { return; }

	target = getParent(target, '.tab');
	if (target.matches('#playlist *')) {
		port.emit('playlist_seek', Array.prototype.indexOf.call(tabList.children, target));
	} else if (target.matches('#windows *')) {
		port.emit('tab_focus', +target.dataset.tabId);
	}
});

// remove tab on leftcklick on ".remove"
document.addEventListener('click', function({ target, button, }) {
	if (button || !target.matches || !target.matches('.tab .remove, .tab .remove *')) { return; }

	target = getParent(target, '.tab');
	if (target.matches('#playlist *')) {
		port.emit('playlist_delete', Array.prototype.indexOf.call(tabList.children, target));
	} else if (target.matches('#windows *')) {
		port.emit('tab_close', +target.dataset.tabId);
	}
});

// show context menus
document.addEventListener('contextmenu', function(event) {
	const { target, x, y, } = event;
	if (!target.matches) { return; }
	const items = [ ];
	if (target.matches('.tab, .tab *')) {
		const { tabId, } = getParent(target, '.tab').dataset;
		items.push(
			{ label: 'Play video', onClick: () => port.emit('tab_play', +tabId), default: target.matches('#playlist *') && !target.matches('.remove'), },
			{ label: 'Show tab', onClick: () => port.emit('tab_focus', +tabId), default: target.matches('#windows *') && !target.matches('.remove'), },
			{ label: 'Close tab', onClick: () => port.emit('tab_close', +tabId), default: target.matches('.remove'), }
		);
	}
	if (target.matches('#playlist, #playlist *')) {
		items.push(
			{ label: 'Sort by ...', type: 'menu', value: [
				{ label: '... position', onClick: () => port.emit('playlist_sort', 'position'), },
				{ label: '... views (global)', onClick: () => port.emit('playlist_sort', 'viewsGlobal'), },
				{ label: 'Shuffle', onClick: () => port.emit('playlist_sort', 'random'), },
			], }
		);
	}
	if (target.matches('.window .header .title')) {
		const box = windowList.querySelector('#'+ target.htmlFor);
		items.push(
			{ label: (box.checked ? 'Expand' : 'Collapse') +' tab list', onClick: () => box.checked = !box.checked, default: true, }
		);
	}
	if (target.matches('#windows, #windows *')) {
		const windowId = getParent(target, '.window').id.match(/^window-(.+)$/)[1];
		items.push(
			{ label: 'Close window', onClick: () => confirm(
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
			from === target && port.emit('playlist_delete', oldIndex);
			port.emit('playlist_add', { index: newIndex, tabId: +item.dataset.tabId, });
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
		element.querySelector('.icon').style.backgroundImage = `url("https://i.ytimg.com/vi/${ tab.videoId }/default.jpg")`;
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
	window && window.querySelectorAll('.tabs').length === 1 && window.remove();
	return tab.remove();
}
