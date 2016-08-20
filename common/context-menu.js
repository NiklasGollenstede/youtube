'use strict'; define('context-menu', [
], function(
) {

const events = [ 'click', 'blur', 'resize', 'keydown', 'wheel', ];

let current = null;

class ContextMenu {
	constructor({ x, y, items, }) {
		const root = this.root = document.createElement('div');
		root.classList.add('menu-anchor');
		this.active = null;
		root.addEventListener('mousemove', ({ target, }) => (target = target.closest('.menu-item')) && this.setActive(target));
		root.addEventListener('mouseleave', () => this.setActive(null));
		this.addMenu(items, root);
		this.show();
		const width = window.innerWidth, height = window.innerHeight;
		root.style.top  = y +'px';
		root.style.left = x +'px';
		Array.prototype.forEach.call(root.querySelectorAll('.submenu'), menu => {
			const rect = menu.getBoundingClientRect();
			rect.right  > width  && menu.classList.add('to-left');
			rect.bottom > height && menu.classList.add('to-top');
		});
	}

	show() {
		document.body.appendChild(this.root);
		events.forEach(type => window.addEventListener(type, this, true));
		current && current.remove();
		current = this;
	}

	remove() {
		this.root.remove();
		events.forEach(type => window.removeEventListener(type, this, true));
		current = null;
	}

	addMenu(children, item) {
		item.classList.add('menu-submenu');
		const submenu = item.appendChild(document.createElement('div'));
		submenu.className = 'submenu';
		children.forEach(child => child && this.addItem(child, submenu));
	}

	addItem({ type, label, icon, children, value, action, 'default': _default, }, parent) {
		const item = document.createElement('div');
		item.classList.add('menu-item');
		_default && item.classList.add('default');
		if (icon) {
			typeof icon === 'string' && (icon = document.createTextNode(icon));
			const _icon = document.createElement('div');
			_icon.classList.add('icon');
			item.appendChild(_icon).appendChild(icon);
			parent.classList.add('has-icon');
		}
		const _label = item.appendChild(document.createElement('div'));
		_label.classList.add('label');
		_label.textContent = label;
		switch (type) {
			case 'menu': this.addMenu(children, item); break;
			case 'label': /* falls through */
			default: {
				item.classList.add('menu-label');
			}
		}
		action && item.addEventListener('click', event => !event.button && action(event, value) === this.remove());
		return parent.appendChild(item);
	}

	setActive(item) {
		if (item === this.active) { return; }
		(function remove(item) {
			if (!item) { return; }
			item.classList.remove('active');
			return remove(item.parentNode.closest('.menu-item'));
		})(this.active);
		(function add(item) {
			if (!item) { return; }
			item.classList.add('active');
			return add(item.parentNode.closest('.menu-item'));
		})(item);
		this.active = item || null;
	}

	handleEvent(event) { // click
		switch (event.type) {
			case 'click': {
				if (!event.target.matches || event.target.matches('.menu-anchor, .menu-anchor *')) { return; }
			} break;
			case 'keydown': {
				switch (event.code) {
					case 'Escape': break;
					case 'Enter': {
						this.active && this.active.click();
					} return;
					case 'ArrowDown': {
						if (!this.active) {
							this.setActive(this.root.querySelector(':scope>*>:first-child'));
						} else {
							this.setActive(this.active.nextSibling || this.active.parentNode.firstChild);
						}
					} return;
					case 'ArrowUp': {
						if (!this.active) {
							this.setActive(this.root.querySelector(':scope>*>:last-child'));
						} else {
							this.setActive(this.active.previousSibling || this.active.parentNode.lastChild);
						}
					} return;
					case 'ArrowRight': {
						if (!this.active) {
							this.setActive(this.root.querySelector(':scope>*>:first-child'));
						} else {
							this.active.matches('.menu-submenu') && this.setActive(this.active.querySelector(':scope>*>:first-child'));
						}
					} return;
					case 'ArrowLeft': {
						const active = this.active && this.active.parentNode.closest('.menu-item');
						active && this.setActive(active);
					} return;
					default: return;
				}
			} break;
			case 'wheel': {
				event.stopPropagation(); event.preventDefault();
			} return;
		}
		event.stopPropagation(); event.preventDefault();
		this.remove();
	}
}

return (ContextMenu.ContextMenu = ContextMenu);

});
