(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/event': { setEvent, },
}) => {

class Playlist extends Array {

	/**
	 * Creates a PlayList, which is an Array with a current position (index).
	 * @param  {Array}     options.values    Optional initial values.
	 * @param  {integer}   options.index     Optional initial position.
	 */
	constructor({ values = [ ], index, } = { }) {
		super(...values);
		// called with (currentIndex, oldIndex) whenever this.index changes to a different value slot in this. Does not fire if the current element is shifted.
		this._fireSeek = setEvent(this, 'onSeek', { lazy: false, });
		// called with (atIndex, newValue) whenever a value is added to this.
		this._fireAdd = setEvent(this, 'onAdd', { lazy: false, });
		// called with (fromIndex, oldValue) whenever a value is removed from this.
		this._fireRemove = setEvent(this, 'onRemove', { lazy: false, });
		this._index = 0;
		this.index = index;
	}
	static get [Symbol.species]() { return Array; }

	/**
	 * Points at the current value in this. (Or -1 or Infinity)
	 */
	set index(value) {
		if (typeof value !== 'number') { value = -1; }
		else if (value < 0) { value = -1; }
		else if (value >= this.length) { value = Infinity; }
		else { value <<= 0; }
		const old = this._index; this._index = value;
		old !== value && this._fireSeek([ value, old, ]);
	}
	get index() {
		return this._index;
	}

	/**
	 * Returns the current value.
	 */
	get() {
		return this[this.index];
	}

	/**
	 * Pushes a value to this if value was not in this.
	 * @param  {any}    value  Value to optionally insert.
	 * @return {integer}       The new index of value in this or -1 if value was not inserted.
	 */
	add(value, where = this._index) {
		if (this.indexOf(value) !== -1) { return -1; }
		this.splice(Math.max(0, where), 0, value);
		return Math.min(where, this.length - 1);
	}

	/**
	 * Set this.index to point at the first instance of value in this.
	 * Inserts value after current index if not present.
	 * @param  {any}    value  Value to seek/insert.
	 * @return {integer}       The new index of value in this or -1 if value was not inserted.
	 */
	seek(value) {
		const index = this.index;
		let seeked = this.indexOf(value, this.index); seeked === -1 && (seeked = this.indexOf(value));
		if (seeked !== -1) {
			seeked !== index && this._fireSeek([ this._index = seeked, index, ]);
			return -1;
		}
		if (index < 0 || index >= this.length) {
			this.push(value);
			this._fireSeek([ this._index = this.length - 1, index, ]);
		} else {
			this.splice(index + 1, 0, value);
			this._fireSeek([ this._index = index + 1, index, ]);
		}
		return this.index;
	}

	/**
	 * Removes all instances of a value from this.
	 * @param  {any}        value  Value to remove.
	 * @return {natural}           Number of elements removed.
	 */
	delete(value) {
		let deleted = 0;
		for (let i = 0; i < this.length; ++i) {
			if (this[i] === value) {
				this.splice(i, 1);
				++deleted;
			}
		}
		return deleted;
	}

	/**
	 * Tests whether the value at the current index exist and optionally satisfies a condition.
	 * @param  {function}  test  Optional condition to satisfy.
	 * @return {bool}      True  iff this.index points at a value in this and that value satisfied the test (if a test is specified).
	 */
	is(test) {
		const current = this.get();
		return !!(current && (!test || test(current)));
	}

	/**
	 * Native array methods that change `this`. Modified to logically preserve .index and to call the event handlers.
	 */

	splice(at, remove, ...items) {
		if (at >= this.length) { at = this.length; }
		else { at <<= 0; }
		if (this._index >= at && this._index < at + remove) {
			const was = this._index, now = at + remove;
			this._fireSeek([ this._index = now < this.length ? now : Infinity, was, ]);
		}
		let removed = 0; for (let i = 0; i < remove && this.length > at; ++i) {
			const [ was, ] = super.splice(at, 1); ++removed;
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

	push() {
		this.splice(this.length - 1, 0, ...arguments);
		return this.length;
	}

	pop() {
		return this.splice(this.length - 1, 1)[0];
	}

	shift() {
		return this.splice(0, 1)[0];
	}

	unshift() {
		this.splice(0, 0, ...arguments);
		return this.length;
	}

	// TODO: .sort() and .reverse() should keep the element at .index and move around it

	sort() {
		const current = this.get();
		super.sort(...arguments);
		this.splice(0, Infinity, ...this); // trigger event handlers
		this.index = super.lastIndexOf(current);
		return this;
	}

	reverse() {
		this.splice(0, Infinity, ...this.slice().reverse()); // trigger event handlers
		this._index = this.length - 1 - this.index;
		return this;
	}
}

return Playlist;

}); })(this);
