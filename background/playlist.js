'use strict'; define('background/playlist', [
	'es6lib',
], function({
	object: { Class, },
}) {

class PlayList extends Array {
	constructor({ values, index, loop, onSeek, } = { }) {
		super(...(values || [ ]));
		this._index = index != null ? index : -1;
		this.loop = !!loop;
		this.onSeek = onSeek || (x => x);
	}

	set index(value) {
		if (typeof value !== 'number') { value = -1; }
		else if (value < 0) { value = -1; }
		else if (value >= this.length) { value = Infinity; }
		this._index = value;
		this.onSeek(value);
	}
	get index() {
		return this._index;
	}

	get() {
		return this[this.index];
	}

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
	 * Pushes value to this if value was not in this.
	 * @param  {any}    value  Value to optionally insert.
	 * @return {bool}          True if value was not present in this.
	 */
	add(value) {
		if (this.indexOf(value) !== -1) { return false; }
		this.push(value);
		return true;
	}

	insertAt(index, value) {
		this.splice(index, 0, value);
		return (this.index = this.index + (index <= this.index));
	}

	/**
	 * Set this.index to point at the first instance of value in this.
	 * Inserts value after curremt index if not present.
	 * @param  {any}    value  Value to seek/insert.
	 * @return {bool}          True if value was not present in this.
	 */
	seek(value) {
		const index = this.index;
		this._index = this.indexOf(value, this.index);
		if (this._index !== -1) { this.index = this._index; return false; }
		this._index = this.indexOf(value);
		if (this._index !== -1) { this.index = this._index; return false; }
		if (index < 0 || index >= this.length) {
			this.push(value);
			this.index = this.length - 1;
		} else {
			this.splice(index, 0, value);
			this.index = index + 1;
		}
		return true;
	}

	/**
	 * Removes all instances of value from this.
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

	deleteAt(index) {
		if (index == this.length - 1 && index == this.index) { this.index = Infinity; return this.pop(); }
		this.index = this.index - (index < this.index);
		return this.splice(index, 1)[0];
	}

	is(test) {
		const current = this.get();
		return !!(current && test(current));
	}
}

return (PlayList.PlayList = PlayList);

});
