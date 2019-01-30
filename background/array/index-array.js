(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	SpliceArray,
}) => {

class IndexArray extends SpliceArray {

	/**
	 * Creates a IndexArray, which is an Array with a current position (index).
	 * @param  {Array}     options.values    Optional initial values.
	 * @param  {integer}   options.index     Optional initial position.
	 */
	constructor({ values = [ ], index, } = { }) {
		super(...values);
		// Fired with `(currentIndex, oldIndex)` directly after `.index` was changed to a different value slot in `this`.
		// Does not fire if the current element was shifted, i.e. the numerical value if `.index` can change without fireing this event.
		this._fireSeek = setEvent(this, 'onSeek');
		// Fired with `(atIndex, newValue)` directly after a value was added to `this`.
		this._fireAdd = setEvent(this, 'onAdd');
		// Fired with `(fromIndex, oldValue)` directly after a value was removed from `this`.
		this._fireRemove = setEvent(this, 'onRemove');
		this._index = 0;
		this.index = index;
	}

	/// Points at the current value in `this`. (Or `-1` or `Infinity`)
	get index() { return this._index; }
	set index(value) {
		value = IndexArray.normalizeIndex(value, this.length);
		const old = this._index; this._index = value;
		old !== value && this._fireSeek([ value, old, ]);
	}

	/// Modified to logically preserve `.index` and to emit the add/remove events.
	splice(at, remove, ...items) { // all other modifying methods use `.splice()`
		at = Math.floor(at) || 0; at = Math.min(Math.max(0, at < 0 ? this.length - at : at), this.length);
		remove = Math.max(0, Math.floor(remove) || 0);

		const oldIndex = this._index; if (oldIndex >= at && oldIndex < at + remove) {
			const offset = items.indexOf(this.get()); if (offset > 0) { // preserve `.index` on element
				const removed =  this.slice(at, at + remove);
				IndexArray.prototype.splice.call(this, at, oldIndex - at);
				IndexArray.prototype.splice.call(this, at + 1, remove - (oldIndex - at) - 1);
				IndexArray.prototype.splice.call(this, at, 0, ...items.slice(0, offset));
				IndexArray.prototype.splice.call(this, at + offset + 1, 0, ...items.slice(offset + 1));
				return removed;
			} else { // must move `.index` to different element
				this.index = at + remove < this.length ? at + remove : Infinity;
			}
		}
		const removed = [ ]; for (let i = 0; i < remove && this.length > at; ++i) {
			const was = super.splice(at, 1)[0]; removed.push(was);
			this._index > at && --this._index;
			this._fireRemove([ at, was, ]);
		}
		for (let i = 0; i < items.length; ++i) {
			this._index >= at && ++this._index;
			super.splice(at + i, 0, items[i]);
			this._fireAdd([ at + i, items[i], ]);
		}
		return removed;
	}

	static get [Symbol.species]() { return SpliceArray[Symbol.species]; } /// Redirects to `Super` class.

	static normalizeIndex(value, length) {
		if (typeof value !== 'number') { return -1; }
		else if (value >= length) { return Infinity; }
		else if (!(value >= 0)) { return -1; }
		else { return value |0; }
	}
}

return IndexArray;

}); })(this);
