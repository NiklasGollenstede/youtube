(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/loader/views': { locationFor, },
	'node_modules/es6lib/dom': { createElement, },
	'fetch!./context-menu.css:css': style,
}) => {

const events = [
	'click', 'contextmenu', 'keydown', 'wheel',
	'unload',
	'blur', 'resize',
];

style = createElement('style', [ style, ]);

function ContextMenuClass(window) { return class ContextMenu extends window.HTMLElement {
	constructor({ x = 0, y = 0, width = 0, items = null, autoReflow = true, } = { }) {
		super();
		this.active = null; this.autoReflow = !!autoReflow;
		this.attachShadow({ mode: 'open', });
		this.shadowRoot.appendChild(window.document.importNode(style, true));
		const root = this.root = this.shadowRoot.appendChild(createElement('div', { className: 'root', }));
		[ 'mousemove', 'mouseleave', ].forEach(type => root.addEventListener(type, this));
		items && addMenu(root, items);
		this.setPosition({ x, y, width, });
	}

	setItems(items) {
		this.root.textContent = ''; addMenu(this.root, items);
	}

	setPosition({ x = 0, y = 0, width = 0, } = { }) {
		this.root.style.top  = y +'px'; this.root.style.left = x +'px';
		this.root.style.width = width +'px';
	}

	updateStates() {
		this.root.querySelectorAll('.item.hidden').forEach(_=>_.classList.remove('hidden'));
		this.root.querySelectorAll('.item.checked').forEach(_=>_.classList.remove('checked'));
		this.root.querySelectorAll('.item.default').forEach(_=>_.classList.remove('default'));
		this.root.querySelectorAll('.item').forEach(({ spec, classList, }) => {
			spec.hidden && classList.add('hidden');
			spec.checked && classList.add('checked');
			spec.default && classList.add('default');
		});
	}

	reflowMenus(reset = true) {
		reset && this.resetReflow();
		this.updateStates();

		// reflow menus to stay within within parent
		const bounds = this.parentNode.getBoundingClientRect();
		this.root.querySelectorAll('.menu').forEach(menu => {
			const rect1 = menu.getBoundingClientRect();
			rect1.right  > bounds.right  && menu.classList.toggle('to-left');
			rect1.bottom > bounds.bottom && menu.classList.toggle('to-top');
			const rect2 = menu.getBoundingClientRect();
			if (rect2.left < bounds.left) { if (rect1.right - bounds.right > bounds.left - rect2.left) {
				menu.style.transform += `translateX(${ (-rect2.left).toFixed(4) }px)`;
			} else {
				menu.classList.toggle('to-left'); const rect3 = menu.getBoundingClientRect();
				menu.style.transform += `translateX(${ (bounds.right - rect3.right).toFixed(4) }px)`;
			} }
			if (rect2.top < bounds.top) { if (rect1.bottom - bounds.bottom > bounds.top - rect2.top) {
				menu.style.transform += `translateY(${ (-rect2.top).toFixed(4) }px)`;
			} else {
				menu.classList.toggle('to-top'); const rect3 = menu.getBoundingClientRect();
				menu.style.transform += `translateY(${ (bounds.bottom - rect3.bottom).toFixed(4) }px)`;
			} }
		});
	}

	resetReflow() {
		this.root.querySelectorAll('.menu.to-left').forEach(_=>_.classList.remove('to-left'));
		this.root.querySelectorAll('.menu.to-top').forEach(_=>_.classList.remove('to-top'));
		this.root.querySelectorAll('.menu[style*="transform"]').forEach(_=>_.style.removeProperty('transform'));
	}

	setActive(item) {
		if (item === this.active) { return; }
		(function remove(item) {
			if (!item) { return; }
			item.classList.remove('active');
			remove(item.parentNode.closest('.item'));
		})(this.active);
		(function add(item) {
			if (!item) { return; }
			item.classList.add('active');
			add(item.parentNode.closest('.item'));
		})(item);
		this.active = item || null;
	}

	connectedCallback() {
		this.autoReflow && this.reflowMenus(true);
		events.forEach(type => window.addEventListener(type, this, true));
	}

	disconnectedCallback() {
		this.setActive(null);
		events.forEach(type => window.removeEventListener(type, this, true));
	}

	handleEvent(event) { // all events
		const target = getTarget(event);
		switch (event.type) {
			/// on the `window`:
			case 'unload': { this.destroy(); } return;
			case 'blur': case 'resize': {
				if (gecko && locationFor(window).type === 'panel') { break; } // firefox fires these events in panels directly after the menu is opened
				this.remove(); return; // hide menu but let propagate
			} break; // eslint-disable-line
			case 'click': case 'contextmenu': { if (this.root.contains(target)) {
				const item = target.closest('.item'); if (!item || event.button) { break; }
				item.spec.action && item.spec.action.call(item.spec, event, item.spec.value); this.remove();
			} else {
				this.remove(); // hide menu and cancel click
			} } break;
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
							this.setActive(this.root.querySelector('.menu').firstChild);
						} else {
							let { active, } = this; do {
								active = active.nextSibling || active.parentNode.firstChild;
							} while (active !== this.active && active.classList.contains('hidden'));
							this.setActive(active);
						}
					} break;
					case 'ArrowUp': {
						if (!this.active) {
							this.setActive(this.root.querySelector('.menu').lastChild);
						} else {
							let { active, } = this; do {
								active = active.previousSibling || active.parentNode.lastChild;
							} while (active !== this.active && active.classList.contains('hidden'));
							this.setActive(active);
						}
					} break;
					case 'ArrowRight': {
						if (!this.active) {
							this.setActive(this.root.querySelector(':scope>*>:first-child'));
						} else {
							this.active.matches('.has-sub') && this.setActive(this.active.querySelector(':scope>*>:first-child'));
						}
					} break;
					case 'ArrowLeft': {
						const active = this.active && this.active.parentNode.closest('.item');
						active && this.setActive(active);
					} break;
					default: return;
				}
			} break;
			case 'wheel': break; // disable scrolling

			/// on `.shadowRoot`:
			case 'mousemove': {
				target.closest('.item') && this.setActive(target.closest('.item'));
			} break;
			case 'mouseleave': { this.setActive(null); } break;
			default: return;
		}
		event.stopPropagation(); event.preventDefault();
	}
}; }

return ContextMenuClass;

function addMenu(root, items) {
	const submenu = root.appendChild(createElement('div', { className: 'menu', }));
	items.forEach(child => child && addItem(submenu, child));
}

function addItem(parent, spec) { let { icon, label, type, } = spec;
	const item = createElement('div', { className: 'item', spec, });
	if (icon) {
		item.appendChild(createElement('div', { className: 'icon', }, [ icon, ]));
		parent.classList.add('has-icon');
	}
	item.appendChild(createElement('div', { className: 'label', }, [ label, ]));
	if (!type && ('checked' in spec)) { type = 'checkbox'; }
	if (!type && ('children' in spec)) { type = 'menu'; }
	switch (type) {
		case 'menu': {
			item.classList.add('has-sub');
			addMenu(item, spec.children);
		} break;
		case 'checkbox': {
			item.classList.add('checkbox');
		} break;
		/*case 'label':*/ default: { void 0; }
	}
	return parent.appendChild(item);
}

function getTarget(event) {
	const target = event.composedPath()[0]; return target.matches ? target : target.parentNode;
}

}); })(this);
