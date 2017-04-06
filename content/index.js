(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { DOMContentLoaded, createElement, },
	'node_modules/es6lib/object': { Class, MultiMap, },
	'node_modules/es6lib/observer': { InsertObserver, },
	'node_modules/es6lib/port': Port,
	'node_modules/es6lib/string': { QueryObject, },
	'node_modules/web-ext-utils/browser/': { runtime, },
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/loader/content': { onUnload, },
	'common/event-emitter': EventEmitter,
	Actions,
	Control,
	Layout,
	Passive,
	Player,
	Ratings,
	require,
}) => { /* global document, location, window, */

/**
 * Event sequence: optionsLoaded navigated* observerCreated navigated+ <destroyed>
 */

const Main = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private) => (function Main() {
		Super.call(this);
		const self = Private(this);
		console.log('Main.construct', this.id = self.id = Math.random() * 0x100000000000000);

		self.styles = createElement('span');
		self.nodesCapture = new Map/*<Node, MultiMap<event, listener>*/;
		self.nodesBubble = new Map/*<Node, MultiMap<event, listener>*/;

		this.on = this.on.bind(this);
		this.once = this.once.bind(this);
		this.setStyle = this.setStyle.bind(this);
		this.addDomListener = this.addDomListener.bind(this);
		this.removeDomListener = this.removeDomListener.bind(this);

		this.options = null;
		this.observer = null;
		self.update(this);

		this.port = new Port(runtime.connect({ name: 'tab', }), Port.web_ext_Port);
		Try(() => (this.actions   = new Actions(this)));
		Try(() => (this.player    = new Player(this)));
		Try(() => (this.layout    = new Layout(this)));
		Try(() => (this.ratings   = new Ratings(this)));
		Try(() => (this.passive   = new Passive(this)));
		Try(() => (this.control   = new Control(this)));

		onUnload.addListener(self.destroy.bind(self));
		this.port.ended.then(self.destroy.bind(self));
		require.async('content/options').then(self.optionsLoaded.bind(self));
	}),

	public: (Private) => ({
		setStyle(id, css) {
			const self = Private(this);
			let style = self.styles.querySelector('#'+ id);
			if (!style) {
				if (css == null) { return null; }
				style = self.styles.appendChild(createElement('style', { id, }));
			} else if (css == null) { style.remove(); return null; }
			style.textContent = css;
			return style;
		},
		addDomListener(node, type, listener, capture) {
			const self = Private(this);
			const nodeMap = (capture ? self.nodesCapture : self.nodesBubble);
			let listeners = nodeMap.get(node); if (!listeners) { listeners = new MultiMap; nodeMap.set(node, listeners); }
			listeners.add(type, listener);
			node.addEventListener(type, listener, !!capture);
			return listener;
		},
		removeDomListener(node, type, listener, capture) {
			const self = Private(this);
			const nodeMap = (capture ? self.nodesCapture : self.nodesBubble);
			const listeners = nodeMap.get(node);
			listeners && listeners.delete(type, listener);
			node.removeEventListener(type, listener, !!capture);
			return node;
		},
	}),

	private: (Private, Protected, Public) => ({
		loaded() {
			const self = Public(this), _this = Protected(this);
			this.update(self);
			document.head.appendChild(this.styles);
			self.observer = new InsertObserver(document);
			_this.emitSync('observerCreated', null);
			_this.clear('observerCreated');
			_this.emitSync('navigated', null);
		},

		navigated() {
			const self = Public(this), _this = Protected(this);
			this.update(self);
			console.log('navigated', location.href);
			_this.emitSync('navigated', null);
		},

		optionsLoaded(options) {
			const self = Public(this), _this = Protected(this);
			this.optionsRoot = options;
			self.options = options.children;
			self.redesign = !!document.querySelector('ytd-app, ytg-app');
			self.redesign && document.documentElement.classList.add('redesign');
			console.log('is redesign', self.redesign);
			// console.log('options loaded', self.options);
			DOMContentLoaded.then(this.loaded.bind(this));
			self.port.addHandler('page.navigated', this.navigated, this);
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
			console.log('Main.destroy', self.id);
			if (this.destroyed) { return; } this.destroyed = true;
			Protected(this).destroy(); // destroy EventEmitter, emits Symbol.for('destroyed')
			Try(() => self.observer.removeAll());
			Try(() => this.optionsRoot.destroy());
			Object.keys(self).forEach(key => delete self[key]);

			this.styles.remove();

			// remove all listeners
			[ this.nodesCapture, this.nodesBubble, ]
			.forEach(nodeMap => {
				const capture = nodeMap === this.nodesCapture;
				nodeMap.forEach((listeners, node) => {
					listeners.forEach((range, type) => range.forEach(listener => {
						node.removeEventListener(type, listener, capture);
					}));
					listeners.clear();
				});
				nodeMap.clear();
			});

			window._main === self && (window._main = null);
		},
	}),
});

function Try(callback) {
	try { callback(); }
	catch (error) { console.error(error); }
}

if (window._main) {
	console.error('Main module already exists', window._main);
	if (gecko) { try {
		window._main.port.destroy();
	} catch (error) { console.error('Failed to destroy previous module', error); } }
	else { return; }
}

window._main = new Main;

}); })(this);

/* global Element, */
!Element.prototype.matches && (Element.prototype.matches = Element.prototype.msMatchesSelector);
!Element.prototype.closest && (Element.prototype.closest = function getParent(selector) { 'use strict';
	let element = this;
	while (element && (!element.matches || !element.matches(selector))) { element = element.parentNode; }
	return element;
});
