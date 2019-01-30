(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Storage, },
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	'node_modules/es6lib/functional': { debounce, },
	'common/options': options,
	'./array/index-array': IndexArray,
	'./array/splice-array': SpliceArray,
	'./array/undo-array': UndoArray,
}) => {

/**
 * Playlist singleton.
 */
const PlaylistClass = class Playlist extends UndoArray.extends(IndexArray, {
	mapPrivateProperties: { set(i, v) { i._undo = v; }, get(i) { return i._undo; }, },
	instanceOptions: { limit: 20, commit: 1e3, },
}) {

	/// Whether incrementing `.index` past the end or decrementing it to lower than `0` will wrap it around.
	set loop(value) {
		value = !!value; if (this._loop === value) { return; }
		this._loop = value; this._fireLoop && this._fireLoop([ value, ]);
	} get loop() { return this._loop; }

	/// Fired with `(loop)` directly after `.loop` was actually toggled.
	get onLoop() { return this._onLoop || (this._fireLoop = setEvent(this, '_onLoop')); }

	/// Seeks the `.index` forward or backward by `1`, which may cause it to wrap it `.loop === true`.
	next() { this.index++; } prev() { this.index--; }

	/// Returns the value `.index` currently points at, if any.
	get() { return this[this.index]; }

	/**
	 * Set `.index` to point at the first instance of `value` in `this`.
	 * Inserts `value` after current index if not present.
	 * @param  {any}    value  Value to seek/insert.
	 * @return {integer}       The new index of `value` in `this` or `-1` if `value` was not inserted.
	 */
	seek(value) {
		const index = this.index;
		let seeked = this.indexOf(value, this.index); seeked === -1 && (seeked = this.indexOf(value));
		if (seeked !== -1) { this.index = seeked; return -1; }
		if (index < 0 || index >= this.length) { this.push(value); this.index = this.length - 1; }
		else { this.splice(index + 1, 0, value); this.index = index + 1; }
		return this.index;
	}

	/// Just forwards its `arguments`.
	constructor() { super(...arguments); this._loop = false; this._fireLoop = this._onLoop = null; }

	/// Overwritten to implement the `.loop` semantic.
	set index(to) {
		const from = this.index; if (this._loop) {
			to = IndexArray.normalizeIndex(to, this.length);
			if (to === Infinity && from === this.length - 1) {
				to = 0; // loop forward
			} else if (to === -1 && from === 0) {
				to = this.length - 1; // loop backwards
			}
		} super.index = to;
	} get index() { return super.index; }

};

// load the saved playlist
const Playlist = new PlaylistClass((await
	Storage.local.get([ 'playlist.values', 'playlist.index', ])
	.then(_ => ({ values: _['playlist.values'], index: _['playlist.index'], }))
));

// save the playlist shortly after it is modified
const savePlaylist = debounce(() => Storage.local.set({ 'playlist.values': Playlist.slice(), 'playlist.index': Playlist.index, }), 1e3);
Playlist.onAdd(savePlaylist); Playlist.onRemove(savePlaylist);
Playlist.onSeek(debounce(() => Storage.local.set({ 'playlist.index': Playlist.index, }), 1e3));

// synchronize `.loop` with the `playlist.loop` setting
options.playlist.children.loop.whenChange(([ value, ]) => { Playlist.loop = value; });
Playlist.onLoop(value => { options.playlist.children.loop.value = value; });

// While the `Playlist` is meant as a singleton, there is no technical reason not to create additional `Playlist.constructor` instances.
Object.defineProperty(Playlist, 'constructor', { value: PlaylistClass, configurable: true, });

// only expose wrapped instance
return SpliceArray.warpAccessors(Playlist, {
	// privateKey(key) { return typeof key === 'string' && key[0] === '_'; },
});

}); })(this);
