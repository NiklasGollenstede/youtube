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

chrome.runtime.onConnect.addListener(function(port) {
	console.log('connect', port);
	port.emit = function(type, ...args) { this.postMessage({ type, args, }); };
	workers.add(port);
	playlist.add(port);
	console.log('add', playlist);

	port.onMessage.addListener(({ type, args}) => ({
		playing() {
			console.log('playing');
			port.playing = true;
			playlist.seek(port);
		},
		videoCued() {
			console.log('videoCued');
		},
		paused() {
			console.log('paused');
			port.playing = false;
		},
		ended() {
			console.log('ended');
			port.playing = false;
		},
	})[type](...args));

	port.onDisconnect.addListener(() => {
		workers.delete(port);
		playlist.delete(port);
		console.log('delete', playlist);
		port.playing && playTab(playlist.get());
	});
});

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
}
