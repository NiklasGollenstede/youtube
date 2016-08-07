'use strict'; (() => {

const {
	dom: { CreationObserver, DOMContentLoaded, createElement, getParent, },
	format: { QueryObject, },
	object: { Class, setConst, copyProperties, },
	namespace: { IterableNameSpace, },
} = require('es6lib');
const { storage: Storage, applications: { gecko, chromium, }, } = require('web-ext-utils/chrome');

/**
 * Event sequence: optionsLoaded (navigate|navigated)* observerCreated navigated (navigate|navigated)* <destroyed>
 */

const Main = new Class({
	extends: { public: require('common/event-emitter'), },

	constructor: (Super, Private, Protected) => (function() {
		Super.call(this);
		const self = Private(this);

		self.styles = createElement('span');
		self.nodesCapture = new IterableNameSpace;
		self.nodesBubble = new IterableNameSpace;

		this.on = this.on.bind(this);
		this.once = this.once.bind(this);
		this.addStyle = this.addStyle.bind(this);
		this.addStyleLink = this.addStyleLink.bind(this);
		this.addDomListener = this.addDomListener.bind(this);
		this.removeDomListener = this.removeDomListener.bind(this);

		this.options = null;
		this.observer = null;
		self.update(this);
		this.gaming = location.host === 'gaming.youtube.com';

		function error(error) { console.error('Failed to load module:', error); }
		try { this.port = new (require('content/port'))(this); } catch(e) { error(e); }
		try { this.actions = new (require('content/actions'))(this); } catch(e) { error(e); }
		try { this.player = new (require('content/player'))(this); } catch(e) { error(e); }
		try { this.layout = new (require('content/layout'))(this); } catch(e) { error(e); }
		try { this.ratings = new (require('content/ratings'))(this); } catch(e) { error(e); }
		try { this.passive = new (require('content/passive'))(this); } catch(e) { error(e); }
		try { this.control = new (require('content/control'))(this); } catch(e) { error(e); }

		this.port.on(Symbol.for('destroyed'), self.destroy.bind(self));
		require.async('content/options').then(self.optionsLoaded.bind(self));
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
			_this.emitSync('observerCreated', null);
			_this.clear('observerCreated');
			_this.emitSync('navigated', null);
		},

		navigate({ detail, }) {
			const self = Public(this), _this = Protected(this);
			this.update(self);
			console.log('navigate', detail.url);
			_this.emitSync('navigate', detail);
		},

		navigated() {
			const self = Public(this), _this = Protected(this);
			this.update(self);
			console.log('navigated', location.href, self);
			_this.emitSync('navigated', null);
		},

		optionsLoaded(options) {
			const self = Public(this), _this = Protected(this);
			this.optionsRoot = options;
			self.options = options.children;
			console.log('options loaded', self.options);
			DOMContentLoaded.then(this.loaded.bind(this));
			if (self.gaming) {
				self.port.on('navigated', ({ url, }) => this.navigate({ detail: { url, }, }) === this.navigated());
			} else {
				self.addDomListener(window, 'spfrequest', this.navigate.bind(this));
				self.addDomListener(window, 'spfdone', this.navigated.bind(this));
			}
			_this.emitSync('optionsLoaded', self.options);
			_this.clear('optionsLoaded');
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
			self.observer.removeAll();
			Object.keys(self).forEach(key => delete self[key]);

			this.styles.remove();

			this.optionsRoot.destroy();

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

			window.main = null;
		},
	}),
});

if (window.main) {
	console.error('Main module already exists', window.main);
	if (gecko) { window.main.port.destroy(); }
	else { return; }
}
const main = window.main = new Main;

})();
