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

		self.updateIds(this);

		window.addEventListener('DOMContentLoaded', self.loaded.bind(self));
		window.addEventListener('spfdone', setTimeout.bind(null, self.navigated.bind(self)), 10); // TODO: remove timeout (?)
	}),

	private: (Private, Protected, Public) => ({
		loaded() {
			const self = Public(this);
			this.updateIds();
			self.observer = new CreationObserver(document);
			self.observer.all('#movie_player', this.navigated.bind(this));
			Protected(this).emitSync('observerCreated', self);
		},

		navigated() {
			const self = Public(this);
			this.updateIds();
			console.log('navigated', location.href, self);
			Protected(this).emitSync(self.videoId ? 'playerCreated' : 'playerRemoved', self);
		},

		updateIds(self = Public(this)) {
			const info = location.pathname === '/watch' && new QueryObject(location.search);
			self.videoId = info && info.v;
			self.listId = info && info.list;
		},
	}),
});
