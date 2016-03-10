'use strict'; define('background/playlist', [
	'es6lib',
], function({
	object: { Class, },
}) {

class PlayList extends Array {
	constructor({ loop, init, } = { }) {
		super(...(init || [ ]));
		this.index = -1;
		this.loop = loop;
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

	add(value) {
		if (this.indexOf(value) !== -1) { return false; }
		if (this.index < 0 || this.index >= this.length) {
			this.push(value);
		} else {
			for (let i = this.length - 1; i > this.index; --i) {
				this[i + 1] = this[i];
			}
			this[this.index + 1] = value;
		}
		return true;
	}

	seek(value) {
		this.index = this.indexOf(value, this.index);
		if (this.index !== -1) { return false; }
		this.index = this.indexOf(value);
		if (this.index !== -1) { return false; }
		this[this.index = this.length] = value;
		return true;
	}

	delete(value) {
		let deleted = 0;
		const filtered = this.filter((item, index) => {
			if (item === value) {
				this.index >= index && --this.index;
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
}

return (PlayList.PlayList = PlayList);

});
