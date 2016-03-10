'use strict';

const {
	concurrent: { async, spawn, sleep, timeout, },
	dom: { clickElement, createElement, CreationObserver, notify, once, saveAs, },
	format: { hhMmSsToSeconds, numberToRoundString, timeToRoundString, QueryObject, },
	functional: { noop, Logger, log, },
	object: { copyProperties, },
	network: { HttpRequest, },
} = require('es6lib');

console.log('background running');

// init options
chrome.storage.local.get('defaultOptions', ({ defaultOptions, }) => /*defaultOptions ||*/ chrome.storage.local.set({ defaultOptions: require('options/defaults'), }));
chrome.storage.sync.get('options', ({ options, }) => /*options ||*/ chrome.storage.sync.set({ options: require('options/utils').simplify(require('options/defaults')), }));

const workers = new Set;
const playlist = new (require('background/playlist'))();
let panel = null;

chrome.runtime.onConnect.addListener(port => {
	port.emit = function(type, ...args) { this.postMessage({ type, args, }); };
	port.sender.tab ? handleTab(port) : handlePanel(port);
});

function handlePanel(port) {
	console.log('panel', port);
	panel = port;

	port.onMessage.addListener(({ type, args}) => ({
		tab_focus(tabId) {
			console.log('tab_focus', tabId);
		},
		playlist_add(index, tabId) {
			console.log('playlist_add', index, tabId);
		},
		playlist_seek(index) {
			console.log('playlist_seek', index);
		},
		playlist_delete(index) {
			console.log('playlist_delete', index);
		},
	})[type](...args));

	port.emit('init', {
		windows: ((windows) => (workers.forEach(({ sender: { tab, }, }) => {
			!windows[tab.windowId] && (windows[tab.windowId] = { id: tab.windowId, tabs: [ ], });
			windows[tab.windowId].tabs.push(infoOf(tab));
		}), windows))({ }),
		playlist: playlist.map(({ sender: { tab, }, }) => infoOf(tab)),
		active: playlist.index,
		state: {
			playing: playlist.get() && playlist.get().playing || false,
		},
	});

	port.onDisconnect.addListener(() => panel = null);
}

function handleTab(port) {
	console.log('tab', port);

	workers.add(port);
	playlist.add(port);
	console.log('add', playlist);

	port.onMessage.addListener(({ type, args}) => ({
		playing(vId) {
			console.log('playing', vId);
			port.playing = true;
			workers.add(port);
			playlist.seek(port);
		},
		videoCued(vId) {
			console.log('videoCued', vId);
		},
		paused(vId) {
			console.log('paused', vId);
			port.playing = false;
		},
		ended(vId) {
			console.log('ended', vId);
			removeTab(port);
		},
	})[type](...args));

	port.onDisconnect.addListener(() => removeTab(port));
}

function removeTab(port) {
	port.playing = false;
	workers.delete(port);
	playlist.delete(port);
	console.log('delete', playlist);
	port.playing && playTab(playlist.get());
}

chrome.commands.onCommand.addListener(command => {
	console.log('command', command);
	switch (command) {
		case 'MediaPlayPause': {
			pauseAllBut(null);
			const port = playlist.get();
			port && !port.playing && playTab(port);
		} break;
		case 'MediaNextTrack': {
			playlist.next() && playTab(playlist.get());
		} break;
		case 'MediaPrevTrack': {
			playlist.prev() && playTab(playlist.get());
		} break;
	}
});

function pauseAllBut(exclude) {
	workers.forEach(port => port !== exclude && port.emit('pause', Date.now()));
}

function playTab(port) {
	port && port.emit('play', Date.now());
	pauseAllBut(port);
}

function infoOf({ id, url, title, windowId, }) {
	const videoId = url.match(/(?:v=)([\w-_]{11})/)[1];
	return {
		tabId: id, windowId, videoId, title: title.replace(/ *-? ?YouTube$/i, ''),
	};
}
