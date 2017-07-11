(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
}) => {

const now = Promise.resolve(), destroyed = Symbol.for('destroyed');

class EventEmitter {
	constructor() {
		this._on = new Map;
	}
	on(name, cb) {
		add(this, name, cb, false);
		return cb;
	}
	once(name, cb) {
		add(this, name, cb, true);
		return cb;
	}
	off(name, cb) {
		const on = this._on && this._on[name];
		if (!on) { return this; }
		on.delete(cb);
		!on.size && delete this._on[name];
		return this;
	}
	promise(name, cancel = destroyed) {
		return new Promise((resolve, reject) => {
			const good = value => { this._on && this._on[cancel].delete(bad); resolve(value); };
			const bad = error => { this._on && this._on[name].delete(good); reject(
				typeof error === 'object' && error !== null && (/error|exception/i).test(error.name)
				? error : new Error(`Cancel event ${ cancel } occurred before ${ name }`)
			); };
			add(this, name, good, true);
			add(this, cancel, bad, true);
		});
	}
	_emit(name, value) {
		if (name === destroyed) { throw new Error('Cannot emit EventEmitter.destroyed'); }
		const on = this._on && this._on[name];
		if (!on) { return; }
		on.forEach((once, cb) => {
			now.then(() => cb(value)).catch(error => { console.error('"'+ name +'" event handler threw:', error); });
			once && on.delete(cb);
		});
		!on.size && delete this._on[name];
	}
	_emitSync(name, value) {
		if (name === destroyed) { throw new Error('Cannot emit EventEmitter.destroyed'); }
		const on = this._on && this._on[name];
		const cbs = [ ];
		if (!on) { return cbs; }
		on.forEach((once, cb) => {
			cbs.push(cb);
			once && on.delete(cb);
		});
		!on.size && delete this._on[name];
		return cbs.map(cb => { try { return cb(value); } catch (error) { // TODO: this should still catch async errors
			console.error('"'+ name +'" event handler threw:', error);
			return null;
		} });
	}
	_clear(name) {
		const on = this._on && this._on[name];
		if (!on) { return 0; }
		const { size, } = on;
		on.clear();
		delete this._on[name];
		return size;
	}
	_destroy(error) {
		if (!this._on) { return; }
		const on = this._on[destroyed];
		this._on = null;
		on && on.forEach((once, cb) => {
			try { cb(error); } catch (error) { console.error('EventEmitter.destroyed event handler threw:', error); }
		});
	}

	static get destroyed() { return destroyed; }
}

function add(it, key, value, once) {
	if (!it.on) { return; }
	let on = it._on[key];
	if (!on) { on = it._on[key] = new Map; }
	on.set(value, once || on.get(value));
}

return EventEmitter;

}); })(this);
