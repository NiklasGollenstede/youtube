'use strict'; (() => {

require('common/chrome').storage.sync.get('options')
.then(({ options, }) => new Main(options.content));

const {
	dom: { CreationObserver, DOMContentLoaded, createElement, },
	format: { QueryObject, },
	object: { Class, setConst, },
	namespace: { IterableNameSpace, },
} = require('es6lib');

const EventEmitter = require('common/event-emitter');


const Main = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function(options) {
		Super.call(this);
		const self = Private(this);
		console.log('content attatched', options);

		this.options = options;
		self.styles = createElement('span');
		self.nodesCapture = new IterableNameSpace;
		self.nodesBubble = new IterableNameSpace;

		this.addStyle = this.addStyle.bind(this);
		this.addStyleLink = this.addStyleLink.bind(this);
		this.addDomListener = this.addDomListener.bind(this);
		this.removeDomListener = this.removeDomListener.bind(this);

		this.videoId = null;
		this.listId = null;
		this.navigationTarget = { url: null, };

		this.port = new (require('content/port'))(this);
		this.player = new (require('content/player-proxy'))(this);
		this.layout = new (require('content/layout'))(this);
		this.ratings = new (require('content/ratings'))(this);
		this.passive = new (require('content/passive'))(this);
		this.actions = new (require('content/actions'))(this);
		this.control = new (require('content/control'))(this);
		this.observer = null;

		self.update(this);

		this.port.on(Symbol.for('destroyed'), self.destroy.bind(self));
		DOMContentLoaded.then(self.loaded.bind(self));
		this.addDomListener(window, 'spfrequest', self.navigate.bind(self));
		this.addDomListener(window, 'spfdone', self.navigated.bind(self));
	}),

	public: (Private, Protected, Public) => ({
		addStyle(css) {
			const self = Private(this);
			return self.styles.appendChild(createElement('style', {
				textContent: css,
			}));
		},
		addStyleLink(href) {
			const self = Private(this);
			return self.styles.appendChild(createElement('link', {
				rel: 'stylesheet', href,
			}));
		},
		addDomListener(node, type, listener, capture) {
			const self = Private(this);
			const _node = (capture ? self.nodesCapture : self.nodesBubble)(node);
			const _type = _node[type] || (_node[type] = new Set);
			_type.add(listener);
			node.addEventListener(type, listener, !!capture);
			return listener;
		},
		removeDomListener(node, type, listener, capture) {
			const self = Private(this);
			const _node = (capture ? self.nodesCapture : self.nodesBubble)(node);
			const _type = _node[type];
			_type && _type.delete(listener);
			node.removeEventListener(type, listener, !!capture);
			return node;
		},
	}),

	private: (Private, Protected, Public) => ({
		loaded() {
			const self = Public(this), _this = Protected(this);
			this.update(self);
			document.head.appendChild(this.styles);
			self.observer = new CreationObserver(document);
			_this.emitSync('observerCreated', self);
			_this.emitSync('navigated', self);
			self.observer.all('#movie_player', () => _this.emitSync('playerCreated', self));
		},

		navigate({ detail: { url, }, }) {
			const self = Public(this), _this = Protected(this);
			this.update(self);
			console.log('navigate', url);
			self.navigationTarget = { url, };
			_this.emitSync('navigate', self);
			self.navigationTarget = { url: null, };
		},

		navigated() {
			const self = Public(this), _this = Protected(this);
			this.update(self);
			console.log('navigated', location.href, self);
			_this.emitSync('navigated', self);
		},

		update(self = Public(this)) {
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

			this.styles.remove();

			// remove all listeners
			[ this.nodesCapture, this.nodesBubble ]
			.forEach(nodes => nodes.forEach((_node, node) => {
				Object.keys(_node).forEach(type => {
					const _type = _node[type];
					_type.forEach(listener => node.removeEventListener(type, listener, nodes === self.nodesCapture));
					_type.clear();
				});
				nodes.destroy();
			}));
		},
	}),
});

})();
