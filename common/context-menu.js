'use strict'; define('context-menu', [
], function(
) {

class ContextMenu {
	constructor({ x, y, items, }) {
		const element = this.element = document.createElement('div');
		element.className = 'popup-menu';
		document.body.click();
		document.body.classList.add('context-menu-showing');
		document.body.appendChild(element);
		document.body.addEventListener('click', this, true);
		items.forEach(item => item && this.addItem(item));
		element.style.top = (y + element.clientHeight > window.innerHeight ? y - element.clientHeight - 1 : y + 1) +'px';
		element.style.left = (x + element.clientWidth > window.innerWidth ? x - element.clientWidth - 1 : x + 1) +'px';
	}

	addItem({ type, label, children, value, action, default: _default, }, parent = this.element) {
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
				children.forEach(child => child && this.addItem(child, submenu));
			} break;
			case 'label':
			default: {
				item.classList.add('menu-label');
			}
		}
		action && item.addEventListener('click', event => !event.button && action(event, value) === this.remove());
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
