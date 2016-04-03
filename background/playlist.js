'use strict'; define('background/playlist', [
], function(
) {

class PlayList extends Array {

	/**
	 * Creates a PlayList, which is an Array with a current position (index).
	 * @param  {Array}  options.values Optional initial values.
	 * @param  {[type]} options.index  Optional initial position.
	 * @param  {[type]} options.loop   If true, .next() and .pref() will wrap around instead of seeking past the end/ before the beginning.
	 * @param  {[type]} options.onSeek Optional function that will be called whenever this.index changes.
	 */
	constructor({ values, index, loop, onSeek, } = { }) {
		super(...(values || [ ]));
		this._index = index != null ? index : -1;
		this.loop = !!loop;
		this.onSeek = onSeek || (x => x);
	}

	/**
	 * Points at the current value in this. (Or -1 or Infinity)
	 */
	set index(value) {
		if (typeof value !== 'number') { value = -1; }
		else if (value < 0) { value = -1; }
		else if (value >= this.length) { value = Infinity; }
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
	 * Insrets a value into this at a secified position.
	 * @param  {natural}  index  The index value will have in this after the insert.
	 * @param  {any}      value  Value to insert.
	 * @return {integer}         The new index of value in this.
	 */
	insertAt(index, value) {
		this.splice(index, 0, value);
		index <= this.index && this.index++;
		return index;
	}

	/**
	 * Set this.index to point at the first instance of value in this.
	 * Inserts value after curremt index if not present.
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
	 * @param  {any}    value  Value to remove.
	 * @return {int}           Number of elements removed.
	 */
	delete(value) {
		let deleted = 0;
		const filtered = this.filter((item, index) => {
			if (item === value) {
				this.index > index && --this.index;
				++deleted;
			} else {
				return true;
			}
		});
		this.length = filtered.length;
		for (let i = 0; i < filtered.length; ++i) {
			this[i] = filtered[i];
		}
		return deleted;
	}

	/**
	 * Removes the value at a specific position.
	 * @param  {natural}  index  Position of the value to remove.
	 * @return {any}             The removed value.
	 */
	deleteAt(index) {
		if (index < this.index) { this.index--; }
		else if (index === this.index && index === this.length - 1) { this.index = this.loop ? 0 : Infinity; }
		return this.splice(index, 1)[0];
	}

	/**
	 * Tests whether the value at the current index satisfies a condition.
	 * @param  {function}  test Condition to satisfy.
	 * @return {bool}      True iff this.index points at a value in this and that value satisfied the test.
	 */
	is(test) {
		const current = this.get();
		return !!(current && test(current));
	}

	/**
	 * Sorts the values in this.
	 * @param  {...}        ...  Same argument as [ ].sort().
	 * @return {PlayList}        this.
	 */
	sort() {
		const current = this.get();
		const sorted = super.sort(...arguments);
		for (let i = 0; i < sorted.length; ++i) {
			this[i] = sorted[i];
		}
		this.index = super.lastIndexOf(current);
		return this;
	}
}

return (PlayList.PlayList = PlayList);

});
