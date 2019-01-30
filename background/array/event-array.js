(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	SpliceArray,
}) => {

class UpdateArray extends SpliceArray {

	constructor() {
		super(...arguments);
		// fired with (atIndex, newValue) directly after a value was added to this.
		this._fireAdd = setEvent(this, 'onAdd');
		// fired with (fromIndex, oldValue) directly after a value was removed from this.
		this._fireRemove = setEvent(this, 'onRemove');
	}

	/// Modified to emit the add/remove events.
	splice(at, remove, ...items) {
		at = Math.floor(at) || 0; at = Math.min(Math.max(0, at < 0 ? this.length - at : at), this.length);
		remove = Math.max(0, Math.floor(remove) || 0);

		const removed = [ ]; for (let i = 0; i < remove && this.length > at; ++i) {
			const was = super.splice(at, 1)[0]; removed.push(was);
			this._fireRemove([ at, was, ]);
		}
		for (let i = 0; i < items.length; ++i) {
			super.splice(at + i, 0, items[i]);
			this._fireAdd([ at + i, items[i], ]);
		}
		return removed;
	}

	static get [Symbol.species]() { return SpliceArray[Symbol.species]; } /// Redirects to `Super` class.
}

return UpdateArray;

}); })(this);
