(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/loader/views': { getViews, },
	'node_modules/es6lib/dom': { createElement, },
}) => {

const events = [
	'click', 'keydown', 'wheel',
	'unload',
	'blur', 'resize', // Firefox fires these events in panels directly after the menu is opened
];

let current = null;

class ContextMenu {
	constructor({ x, y, width, items, host = global.document.body, }) {
		this.host = host;
		const root = this.root = createElement('div', { className: 'menu-anchor', });
		this.active = null;
		root.addEventListener('mousemove', ({ target, }) => (target = target.closest && target.closest('.menu-item')) && this.setActive(target));
		root.addEventListener('mouseleave', () => this.setActive(null));
		this.addMenu(items, root);
		this.show(x, y, width);
	}

	show(x, y, width) {
		const window = this.host.ownerDocument.defaultView;
		this.host.appendChild(this.root);
		this.root.style.top  = y +'px';
		this.root.style.left = x +'px';
		this.root.style.width = (width || 0) +'px';
		const { innerWidth, innerHeight, } = window;
		Array.prototype.forEach.call(this.root.querySelectorAll('.submenu'), menu => {
			const rect1 = menu.getBoundingClientRect();
			rect1.right  > innerWidth  && menu.classList.add('to-left');
			rect1.bottom > innerHeight && menu.classList.add('to-top');
			const rect2 = menu.getBoundingClientRect();
			if (rect2.left < 0) { if (rect1.right - innerWidth > 0 - rect2.left) {
				menu.style.transform += `translateX(${ (-rect2.left).toFixed(4) }px)`;
			} else {
				menu.classList.remove('to-left');
				menu.style.transform += `translateX(${ (innerWidth - rect1.right).toFixed(4) }px)`;
			} }
			if (rect2.top < 0) { if (rect1.bottom - innerHeight > 0 - rect2.top) {
				menu.style.transform += `translateY(${ (-rect2.top).toFixed(4) }px)`;
			} else {
				menu.classList.remove('to-top');
				menu.style.transform += `translateY(${ (innerHeight - rect1.bottom).toFixed(4) }px)`;
			} }
		});
		(gecko && getViews().find(_=>_.view === window).type === 'panel' ? events.slice(0, -2) : events) // remove 'blur' and 'resize'
		.forEach(type => window.addEventListener(type, this, true));
		current && current.remove();
		current = this;
	}

	remove() {
		this.root.remove();
		const window = this.host.ownerDocument.defaultView;
		events.forEach(type => window.removeEventListener(type, this, true));
		current === this && (current = null);
	}
	static remove() {
		current && current.remove();
	}

	addMenu(children, item) {
		item.classList.add('menu-submenu');
		const submenu = item.appendChild(createElement('div', { className: 'submenu', }));
		children.forEach(child => child && this.addItem(child, submenu));
	}

	addItem({ type, label, icon, children, value, checked, action, 'default': _default, }, parent) {
		const item = createElement('div', { className: 'menu-item'+ (_default ? ' default' : ''), });
		if (icon) {
			item.appendChild(createElement('div', { className: 'icon', }, [ icon, ]));
			parent.classList.add('has-icon');
		}
		item.appendChild(createElement('div', { className: 'label', }, [ label, ]));
		if (typeof checked === 'boolean') { type = 'checkbox'; }
		switch (type) {
			case 'menu': {
				this.addMenu(children, item);
			} break;
			case 'checkbox': {
				item.classList.add('menu-checkbox');
				checked && item.classList.add('checked');
			} break;
			/*case 'label':*/ default: {
				item.classList.add('menu-label');
			}
		}
		action && item.addEventListener('click', event => !event.button && action.call(arguments[0], event, value) === this.remove());
		return parent.appendChild(item);
	}

	setActive(item) {
		if (item === this.active) { return; }
		(function remove(item) {
			if (!item) { return; }
			item.classList.remove('active');
			remove(item.parentNode.closest('.menu-item'));
		})(this.active);
		(function add(item) {
			if (!item) { return; }
			item.classList.add('active');
			add(item.parentNode.closest('.menu-item'));
		})(item);
		this.active = item || null;
	}

	destroy() {
		if (!this.root) { return; }
		try { this.remove(); } catch (_) { }
		this.root = this.host = null;
	}

	handleEvent(event) { // all events
		switch (event.type) {
			case 'unload': this.destroy(); return;
			case 'blur': case 'resize': this.remove(); return; // hide menu but let propagate
			case 'click': {
				if (!event.target.matches || event.target.matches('.menu-anchor, .menu-anchor *')) { return; }
				this.remove(); // hide menu and cancel click
			} break;
			case 'keydown': {
				switch (event.code) {
					case 'Space': break; // ignore (and prevent scrolling)
					case 'Escape': {
						this.remove();
					} break;
					case 'Enter': {
						this.active && this.active.click();
					} break;
					case 'ArrowDown': {
						if (!this.active) {
							this.setActive(this.root.querySelector(':scope>*>:first-child'));
						} else {
							this.setActive(this.active.nextSibling || this.active.parentNode.firstChild);
						}
					} break;
					case 'ArrowUp': {
						if (!this.active) {
							this.setActive(this.root.querySelector(':scope>*>:last-child'));
						} else {
							this.setActive(this.active.previousSibling || this.active.parentNode.lastChild);
						}
					} break;
					case 'ArrowRight': {
						if (!this.active) {
							this.setActive(this.root.querySelector(':scope>*>:first-child'));
						} else {
							this.active.matches('.menu-submenu') && this.setActive(this.active.querySelector(':scope>*>:first-child'));
						}
					} break;
					case 'ArrowLeft': {
						const active = this.active && this.active.parentNode.closest('.menu-item');
						active && this.setActive(active);
					} break;
					default: return;
				}
			} break;
			case 'wheel': break; // disable scrolling
			default: return;
		}
		event.stopPropagation(); event.preventDefault();
	}
}

return ContextMenu;

}); })(this);
