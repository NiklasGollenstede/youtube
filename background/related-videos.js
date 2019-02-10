(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/object': { MultiMap, },
	'./array/event-array': EventArray,
	Playlist, VideoInfo,
	utils: { Mutex, RefCounter, },
}) => {

const list = new EventArray;

list.subscribe = function(window) {
	// TODO: enable suspending
	if (true || windows.has(window)) { return list; }
	windows.add(window); windows.size === 1 && refs.resume();
	window.addEventListener('unload', () => {
		windows.delete(window); if (windows.size > 0) { return; }
		refs.suspend(); list.splice(0, Infinity); // start with an empty list next time
	}); return list;
};

const v2r = new Map, r2v = new MultiMap, windows = new Set;

const refs = new RefCounter({ delay: 300, accumulate: true, /*suspended: true,*/ });
Playlist.forEach(id => refs.add(id));
Playlist.onAdd((index, id) => refs.add(id));
Playlist.onRemove((index, id) => refs.drop(id));

refs.onChanged(Mutex(async (added, removed) => {

	added = (await Promise.all(Array.from(added, async id => {
		return { id, related: v2r.get(id) || (await VideoInfo.getData(id).catch(() => ({ }))).related || [ ], };
	})));

	added.forEach(({ id, related, }) => {
		v2r.set(id, related);
		related.forEach(rId => r2v.add(rId, id));
	});
	removed.forEach(id => {
		const related = v2r.get(id); v2r.delete(id);
		related.forEach(rId => r2v.delete(rId, id));
	});

	const now = Array.from(r2v, ([ id, set, ]) => set.size && ({
		id, relating: set, rank: set.size,
	})).filter(_=>_)
	.sort((a, b) => b.rank - a.rank)
	.map((ctx, index, { length, }) => { { // shuffle things around, not too much, but just enough that the last item could become the first
		ctx.rank = length - index + (Math.random() * length / 2) | 0;
	} return ctx; })
	.sort((a, b) => b.rank - a.rank)
	.slice(0, 20)
	.map((ctx) => { {
		ctx.relating = Array.from(ctx.relating);
	} return ctx; });

	list.splice(0, Infinity, ...now);
}));

return list;

}); })(this);
