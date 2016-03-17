'use strict'; /* global Sortable */

let defaultWindow, defaultTab, port, windowList, tabList;

window.addEventListener('DOMContentLoaded', () => {
	defaultWindow = document.querySelector('#window-default');
	defaultTab = document.querySelector('.tab-default');
	windowList = document.querySelector('#windows .windows');
	tabList = document.querySelector('#playlist .tabs');
	defaultWindow.remove(); defaultTab.remove();

	port = chrome.runtime.connect();
	port.emit = function(type, value) { this.postMessage({ type, value, }); };

	port.onMessage.addListener(({ type, value, }) => ({
		init({ windows, playlist, active, state, }) {
			console.log('init', windows, playlist, active, state);
			const videos = [ ];
			Object.keys(windows).forEach(windowId => {
				const win = windows[windowId];
				const tabList = windowList.appendChild(createWindow(win)).querySelector('.tabs');
				win.tabs.sort((a, b) => a.index - b.index).forEach(tab => tabList.appendChild(createTab(tab)));
				enableDragOut(tabList);
				win.tabs.forEach(({ videoId, }) => videos.push(videoId));
			});
			playlist.forEach(tabId => tabList.appendChild(windowList.querySelector('.tab-'+ tabId).cloneNode(true)));
			chrome.storage.local.get(videos.map(videoId => 'videoInfo-'+ videoId), reply => videos.forEach(videoId => {
				const videoInfo = reply['videoInfo-'+ videoId];
				if (!videoInfo) { return console.error('Missing videoInfo for', videoId, 'in', reply); }
				this.tabs_update({ videoId, title: videoInfo.public.title, });
			}));
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
		playlist_add(index, tabId) {
			console.log('playlist_add', index, tabId);
			tabList.insertBefore(windowList.querySelector('.tab-'+ tabId).cloneNode(true), tabList.children[index + 1]);
		},
		playlist_seek(active) {
			console.log('playlist_seek', active);
			Array.prototype.forEach.call(tabList.querySelectorAll('.active'), tab => tab.classList.remove('active'));
			tabList.children[active] && tabList.children[active].classList.add('active');
		},
		playlist_delete(index) {
			console.log('playlist_delete', index);
			tabList.children[index].remove();
		},
		tabs_open(tab) {
			console.log('tabs_open', tab);
			const tabList = windowList.querySelector(`#window-${ tab.windowId } .tabs`);
			const next = Array.prototype.find.call(tabList.children, ({ dataset: { index, }, }) => index > tab.index);
			tabList.insertBefore(createTab(tab), next);
		},
		tabs_update(tab) {
			console.log('tabs_update', tab);
			if ('tabId' in tab) {
				Array.prototype.forEach.call(document.querySelectorAll('.tab-'+ tab.tabId), element => updateTab(element, tab));
			} else if ('videoId' in tab) {
				Array.prototype.forEach.call(document.querySelectorAll('.video-'+ tab.videoId), element => updateTab(element, tab));
			}
		},
		tabs_close(tabId) {
			console.log('tabs_close', tabId);
			Array.prototype.forEach.call(document.querySelectorAll('.tab-'+ tabId), element => element.remove());
		},
	})[type](value));

	[ 'prev', 'play', 'pause', 'next', 'loop', ]
	.forEach(command => document.querySelector('#'+ command).addEventListener('click', ({ button, }) => !button && port.emit('command_'+ command)));
});

// focus tab (windows) or play tab on dblclick
document.addEventListener('dblclick', function({ target, button, }) {
	if (button || !target.matches || !target.matches('.description, .description :not(.remove)')) { return; }

	while (!target.matches('.tab')) { target = target.parentNode; }
	if (event.target.matches('#right *')) {
		port.emit('tab_focus', +target.dataset.tabId);
	} else {
		port.emit('playlist_seek', Array.prototype.indexOf.call(tabList.children, target));
	}
});

// remove tab on leftcklick on ".remove"
document.addEventListener('click', function({ target, button, }) {
	if (button || !target.matches || !target.matches('.tab .remove, .tab .remove *')) { return; }
	while (!target.matches('.tab')) { target = target.parentNode; }
	port.emit('playlist_delete', Array.prototype.indexOf.call(tabList.children, target));
	target.remove();
});

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
		element.querySelector('.icon').style.backgroundImage = `url(\'https://i.ytimg.com/vi/${ tab.videoId }/default.jpg\')`;
	}
	if ('title' in tab) {
		element.querySelector('.title').textContent = tab.title;
	}
	if ('duration' in tab) {
		const duration = typeof tab.duration === 'string' ? tab.duration : (Math.floor(tab.duration / 60) +':'+ tab.duration % 60);
		element.querySelector('.duration').textContent = duration;
	}
	return element;
}
