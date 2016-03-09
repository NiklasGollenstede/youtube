'use strict';

chrome.storage.sync.get('options', x => new Main(x.options.content));

const {
	concurrent: { async, spawn, sleep, timeout, },
	dom: { clickElement, createElement, CreationObserver, DOMContentLoaded, notify, once, saveAs, },
	format: { hhMmSsToSeconds, numberToRoundString, timeToRoundString, QueryObject, },
	functional: { Logger, log, },
	object: { Class, copyProperties, },
	network: { HttpRequest, },
} = require('es6lib');


const Main = new Class({
	extends: { public: require('common/event-emitter'), },

	constructor: (Super, Private, Protected) => (function(options) {
		Super.call(this);
		const self = Private(this);
		console.log('content attatched', options);

		this.options = options;

		this.player = new (require('content/player-proxy'))(this);
		this.layout = new (require('content/layout'))(this);
		this.ratings = new (require('content/ratings'))(this);
		this.passive = new (require('content/passive'))(this);
		this.actions = new (require('content/actions'))(this);
		this.control = new (require('content/control'))(this);
		this.observer = null;

		window.addEventListener('DOMContentLoaded', self.loaded.bind(self));
		window.addEventListener('spfdone', self.navigated.bind(self));
	}),

	private: (Private, Protected, Public) => ({
		playerCreated(target) {
			const self = Public(this);
			Protected(this).emitSync('playerCreated', self);
		},

		loaded() {
			const self = Public(this);
			self.observer = new CreationObserver(document);
			self.observer.all('#movie_player', this.playerCreated.bind(this));
			Protected(this).emitSync('observerCreated', self);
		},

		navigated() {
			const self = Public(this);
			const player = document.querySelector("#player");
			if (!player || player.classList.contains("off-screen")) {
				Protected(this).emitSync('playerRemoved', self);
			} else {
				Protected(this).emitSync('playerCreated', self);
			}
		},
	}),
});
