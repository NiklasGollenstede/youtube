'use strict'; (() => {

chrome.storage.sync.get('options', x => new Main(x.options.content));

const {
	dom: { CreationObserver, DOMContentLoaded, },
	format: { QueryObject, },
	object: { Class, setConst, },
} = require('es6lib');

const EventEmitter = require('common/event-emitter');


const Main = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function(options) {
		Super.call(this);
		const self = Private(this);
		console.log('content attatched', options);

		this.options = options;

		this.port = new (require('content/port'))(this);
		this.player = new (require('content/player-proxy'))(this);
		this.layout = new (require('content/layout'))(this);
		this.ratings = new (require('content/ratings'))(this);
		this.passive = new (require('content/passive'))(this);
		this.actions = new (require('content/actions'))(this);
		this.control = new (require('content/control'))(this);
		this.observer = null;

		self.updateIds(this);

		this.port.on(Symbol.for('destroyed'), self.destroy.bind(self));
		DOMContentLoaded.then(self.loaded.bind(self));
		self.navigated = self.navigated.bind(self);
		window.addEventListener('spfdone', self.navigated);
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

		destroy() {
			const self = Public(this);
			console.log('Main.destroy');
			Protected(this).destroy();
			// TODO: destroy self.observer
			Object.keys(self).forEach(key => delete self[key]);
			window.removeEventListener('spfdone', self.navigated);
		},
	}),
});

})();
