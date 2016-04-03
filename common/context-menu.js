'use strict'; define('context-menu', [
], function(
) {

class ContextMenu {
	constructor({ x, y, items, }) {
		const element = this.element = document.createElement('div');
		element.className = 'popup-menu';
		element.style.top = y +'px';
		element.style.left = x +'px';
		document.body.click();
		document.body.classList.add('context-menu-showing');
		document.body.appendChild(element);
		document.body.addEventListener('click', this, true);
		items.forEach(item => this.addItem(item));
	}

	addItem({ type, label, value, onClick, default: _default, }, parent = this.element) {
		const item = document.createElement('div');
		item.classList.add('menu-item');
		_default && item.classList.add('default');
		const _label = item.appendChild(document.createElement('div'));
		_label.textContent = label;
		switch (type) {
			case 'menu': {
				item.classList.add('menu-submenu');
				const submenu = item.appendChild(document.createElement('div'));
				submenu.className = 'submenu';
				value.forEach(child => this.addItem(child, submenu));
			} break;
			case 'label':
			default: {
				item.classList.add('menu-label');
			}
		}
		onClick && item.addEventListener('click', event => !event.button && onClick(event, value) == this.remove());
		return parent.appendChild(item);
	}

	remove() {
		document.body.classList.remove('context-menu-showing');
		this.element.remove();
		document.body.removeEventListener('click', this, true);
	}

	handleEvent(event) { // click
		if (!event.target.matches || event.target.matches('.popup-menu, .popup-menu *')) { return; }
		event.stopPropagation(); event.preventDefault();
		this.remove();
	}
}

return (ContextMenu.ContextMenu = ContextMenu);

});
