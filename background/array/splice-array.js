(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
}) => {

/**
 * `SpliceArray`: Extends `Array` to redirect all standard `Array` method that modify `this` to calls to `.splice()`.
 * This is useful as a mixin when implementing classes that extend `Array` with custom modification behavior.
 * Each overwritten method calls `.splice()` once, such that, on a default `Array`, the modification remains the same.
 * Note that this only handles method calls, not modifications via the array access operator or `.length`.
 */
const SpliceArray = makeSpliceArray(Array); function makeSpliceArray(Array) { return class SpliceArray extends Array {
	static extends() { return makeSpliceArray.apply(null, arguments); }
	push() { this.splice(Infinity, 0, ...arguments); return this.length; }
	pop() { return this.splice(-1, 1)[0]; }
	shift() { return this.splice(0, 1)[0]; }
	unshift() { this.splice(0, 0, ...arguments); return this.length; }
	sort() { this.splice(0, Infinity, ...slice(this).sort(...arguments)); return this; }
	reverse() { this.splice(0, Infinity, ...slice(this).reverse()); return this; }
	copyWithin(at, ...range) { const insert = slice(this).slice(...range); this.splice(at, insert.length, ...insert); return this; }
	static get [Symbol.species]() { return Array[Symbol.species]; } /// Redirects to `Super` class.
}; }

/**
 * Completes the idea of `SpliceArray` by wrapping an instance in a `Proxy`
 * that also translates modifications via the array access operator or `.length` to `.splice()` calls.
 * Notes that this only handles the `set` tap, not e.g. `definePropery`.
 * Also note that it handles the `get` tap to return modified prototype methods that unwrap the `this`
 * before calling the actual method, to increase the efficiency and consistency of operations within methods.
 * To that end, a static clone of the instances `.__proto__` is created and cached for other objects with the same `.__proto__`
 * (i.e. from outside the proxy, modifications of the classes `.prototype`s won't apply after the first call to this method with that `.__proto__`).
 * @param {array}      self         The instance to wrap.
 * @param {function?}  .privateKey  Optional. Function that is called for every accessed key. If it returns true, the accessor throws.
 */
SpliceArray.warpAccessors = createSetterProxy;

const Self = new WeakMap;
return SpliceArray;

function createSetterProxy(self, { privateKey = () => false, } = { }) {
	const props = propsFor(Object.getPrototypeOf(self));
	const proxy = new Proxy(self, { set(self, key, value) {
		// console.log('set', key, value);
		if (privateKey(key)) { throw new Error(`key can not be written`); }
		if (typeof key === 'string' && (/^\d+$/).test(key)) {
			self.splice(+key, 1, value);
		} else if (key === 'length') {
			value -= 0; if (value !== value|0 || value < 0) { new Array(value); /* throws */ }
			else { self.splice(value, Infinity); }
		} self[key] = value; return true; // this invokes setters
	}, get(self, key) {
		// console.log('get', key);
		if (privateKey(key)) { throw new Error(`key can not be read`); }
		return Object.hasOwnProperty.call(self, key) ? self[key] // get own properties
		: Reflect.get(props, key, self); // return a method that unwraps the proxy, or invoke copied getters with the unwrapped `this` (or return any other non-function property)
	}, }); Self.set(proxy, self); return proxy;
}

function propsFor(proto) {
	if (Self.get(proto)) { return Self.get(proto); }
	const props = { __proto__: null, }, chain = [ ];
	let p = proto; while (p) { chain.push(p); p = Object.getPrototypeOf(p); }
	chain.reverse().forEach(obj => {
		Object.getOwnPropertyNames(obj).forEach(copy);
		Object.getOwnPropertySymbols(obj).forEach(copy);
		function copy(key) {
			const desc = Object.getOwnPropertyDescriptor(obj, key); desc.configurable = true;
			if (typeof desc.value === 'function') {
				const { value: method, } = desc;
				desc.value = function() {
					return method.apply(Self.get(this), arguments);
				};
			} Object.defineProperty(props, key, desc);
		}
	}); Self.set(proto, props); return props;
}

function slice(s) { s = Self.get(s) || s; const l = s.length, t = new Array(l); for (let i = 0; i < l; ++i) { t[i] = s[i]; } return t; }

}); })(this);
