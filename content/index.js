(function(global) { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/chrome/': { Storage, applications: { gecko, }, },
	'node_modules/es6lib/concurrent': { async, spawn, sleep, },
	'node_modules/es6lib/dom': { CreationObserver, DOMContentLoaded, createElement, getParent, },
	'node_modules/es6lib/object': { Class, setConst, copyProperties, },
	'node_modules/es6lib/namespace': { IterableNameSpace, },
	'node_modules/es6lib/string': { QueryObject, },
	'common/event-emitter': EventEmitter,
	Actions,
	Control,
	Layout,
	Passive,
	Port,
	Player,
	Ratings,
}) {

/**
 * Event sequence: optionsLoaded (navigate|navigated)* observerCreated navigated (navigate|navigated)* <destroyed>
 */

const Main = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function() {
		Super.call(this);
		const self = Private(this);

		self.styles = createElement('span');
		self.nodesCapture = new IterableNameSpace;
		self.nodesBubble = new IterableNameSpace;

		this.on = this.on.bind(this);
		this.once = this.once.bind(this);
		this.setStyle = this.setStyle.bind(this);
		this.addDomListener = this.addDomListener.bind(this);
		this.removeDomListener = this.removeDomListener.bind(this);

		this.options = null;
		this.observer = null;
		self.update(this);

		function error(error) { console.error('Failed to load module:', error); }
		try { this.port      = new Port(this);      } catch(e) { error(e); }
		try { this.actions   = new Actions(this);   } catch(e) { error(e); }
		try { this.player    = new Player(this);    } catch(e) { error(e); }
		try { this.layout    = new Layout(this);    } catch(e) { error(e); }
		try { this.ratings   = new Ratings(this);   } catch(e) { error(e); }
		try { this.passive   = new Passive(this);   } catch(e) { error(e); }
		try { this.control   = new Control(this);   } catch(e) { error(e); }

		this.port.once(Symbol.for('destroyed'), self.destroy.bind(self));
		require.async('content/options').then(self.optionsLoaded.bind(self));
	}),

	public: (Private, Protected, Public) => ({
		setStyle(id, css) {
			const self = Private(this);
			const style = self.styles.querySelector('#'+ id)
			|| self.styles.appendChild(createElement('style', { id, }));
			style.textContent = css;
			return style;
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
			self.redesign = !!document.querySelector('ytd-app, ytg-app');
			self.redesign && document.documentElement.classList.add('redesign');
			console.log('is redesign', self.redesign);
			console.log('options loaded', self.options);
			DOMContentLoaded.then(this.loaded.bind(this));
			self.port.on('navigated', ({ url, }) => this.navigate({ detail: { url, }, }) === this.navigated());
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
			if (this.destroyed) { return; } this.destroyed = true;
			Protected(this).destroy(); // destroy EventEmitter, emits Symbol.for('destroyed')
			self.observer.removeAll();
			Object.keys(self).forEach(key => delete self[key]);

			this.styles.remove();

			try { this.optionsRoot.destroy(); } catch (e) { }

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

			window._main = null;
		},
	}),
});

if (window._main) {
	console.error('Main module already exists', window._main);
	if (gecko) { try {
		window._main.port.destroy();
	} catch (error) { console.error('Failed to destroy previous module', error); } }
	else { return; }
}

const main = window._main = new Main;

});

!Element.prototype.matches && (Element.prototype.matches = Element.prototype.msMatchesSelector);
!Element.prototype.closest && (Element.prototype.closest = function getParent(selector) {
	let element = this;
	while (element && (!element.matches || !element.matches(selector))) { element = element.parentNode; }
	return element;
});

})((function() { /* jshint strict: false */ return this; })());
