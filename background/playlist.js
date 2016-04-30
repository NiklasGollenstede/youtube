'use strict'; define('background/playlist', [
], function(
) {

const noop = () => { };

class PlayList extends Array {

	/**
	 * Creates a PlayList, which is an Array with a current position (index).
	 * @param  {Array}     options.values    Optional initial values.
	 * @param  {integer}   options.index     Optional initial position.
	 * @param  {bool}      options.loop      Optional initial value of this.loop. While this.loop is true, .next() and .pref() will wrap around instead of seeking past the end / before the beginning.
	 * @param  {function}  options.onSeek    Optional function that will be called with (currentIndex) whenever this.index changes.
	 * @param  {function}  options.onAdd     Optional function that will be called with (atIndex, newValue) whenever a value is added to this.
	 * @param  {function}  options.onDelete  Optional function that will be called with (fromIndex, oldValue) whenever a value is removed from this.
	 */
	constructor({ values, index, loop, onSeek, onAdd, onDelete, } = { }) {
		super(...(values || [ ]));
		this.onSeek = noop;
		this.index = index;
		this.loop = !!loop;
		this.onSeek = onSeek || noop;
		this.onAdd = onAdd || noop;
		this.onDelete = onDelete || noop;
	}

	/**
	 * Points at the current value in this. (Or -1 or Infinity)
	 */
	set index(value) {
		if (typeof value !== 'number') { value = -1; }
		else if (value < 0) { value = -1; }
		else if (value >= this.length) { value = Infinity; }
		else { value <<= 0; }
		const old = this._index;
		this._index = value;
		old !== value && this.onSeek(value, old);
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
	 * Sets this.index to the next value in this.
	 * @return  {bool}  True iff this.index points at a value in this.
	 */
	next() {
		if (this.index >= this.length - 1) {
			if (!this.loop) { this.index = Infinity; return false; }
			this.index = 0; return true;
		}
		if (this.index < 0) {
			this.index = 0; return true;
		}
		++this.index; return true;
	}

	/**
	 * Sets this.index to the previous value in this.
	 * @return  {bool}  True iff this.index points at a value in this.
	 */
	prev() {
		if (this.index <= 0) {
			if (!this.loop) { this.index = -1; return false; }
			this.index = this.length - 1; return true;
		}
		if (this.index >= this.length) {
			this.index = this.length - 1; return true;
		}
		--this.index; return true;
	}

	/**
	 * Pushes a value to this if value was not in this.
	 * @param  {any}    value  Value to optionally insert.
	 * @return {integer}       The new index of value in this or -1 if value was not inserted.
	 */
	add(value) {
		if (this.indexOf(value) !== -1) { return -1; }
		return this.push(value);
	}

	/**
	 * Set this.index to point at the first instance of value in this.
	 * Inserts value after current index if not present.
	 * @param  {any}    value  Value to seek/insert.
	 * @return {integer}       The new index of value in this or -1 if value was not inserted.
	 */
	seek(value) {
		const index = this.index; let seeked;
		seeked = this.indexOf(value, this.index);
		if (seeked !== -1) { this.index = seeked; return -1; }
		seeked = this.indexOf(value);
		if (seeked !== -1) { this.index = seeked; return -1; }
		if (index < 0 || index >= this.length) {
			this.push(value);
			this.index = this.length - 1;
		} else {
			this.splice(index + 1, 0, value);
			this.index = index + 1;
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
	 * Sorts the values in this.
	 * @param  {...}        ...  Same argument as [ ].sort().
	 * @return {PlayList}        this.
	 */
	sort() {
		const current = this.get();
		const sorted = super.sort(...arguments);
		this.splice(0, Infinity, ...sorted);
		this.index = super.lastIndexOf(current);
		return this;
	}

	push() {
		const length = this.length;
		super.push(...arguments);
		for (let i = 0; i < arguments.length; ++i) {
			this.onAdd(length + i, arguments[i]);
		}
		return this.length;
	}

	pop() {
		const value = super.pop();
		this.onDelete(this.length, value);
		this.index === this.length && this.next();
		return value;
	}

	reverse() {
		super.reverse();
		this.index = this.length - 1 - this.index;
	}

	shift() {
		const value = super.shift();
		this.onDelete(0, value);
		this.index -= 1;
		return value;
	}

	unshift() {
		super.push(...arguments);
		for (let i = 0; i < arguments.length; ++i) {
			this.onAdd(i, arguments[i]);
		}
		return this.length;
	}

	splice(at, remove, ...items) {
		const removed = super.splice(...arguments);
		for (let i = 0; i < removed.length; ++i) {
			this.onDelete(at + i, removed[i]);
		}
		for (let i = 0; i < items.length; ++i) {
			this.onAdd(at + i, items[i]);
		}
		this.index > at && (this.index <= at.remove ? this.next() : (this.index += items.length - remove));
		return removed;
	}
}

return (PlayList.PlayList = PlayList);

});
