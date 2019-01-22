(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/es6lib/object': { MultiMap, },
	'node_modules/es6lib/functional': { debounce, },
	Player, Playlist, VideoInfo,
}) => {

const list = new Playlist;

list.subscribe = function(window) {
	void window; return list;
	// TODO: only update list while at least one window is subscribed, unsubscribe on unload
};

const ids = { }, v2r = new Map, r2v = new MultiMap, added = [ ], removed = [ ];

const update = debounce(() => {
	added.splice(0, Infinity).forEach(({ id, related, }) => {
		if (id in ids) { ++ids[id]; return; } ids[id] = 1;
		v2r.set(id, related);
		related.forEach(rId => r2v.add(rId, id));
	});
	removed.splice(0, Infinity).forEach(id => {
		if (--ids[id] > 0) { return; }
		const related = v2r.get(id);
		related.forEach(rId => r2v.delete(rId, id));
	});

	// TODO: this is inefficient
	const now = Array.from(r2v, ([ id, set, ]) => set.size && ({ id, count: set.size, relating: Array.from(set), }))
	.filter(_=>_).sort((a, b) => b.count - a.count).slice(0, 30);
	list.splice(0, Infinity, ...now);
}, 300);

Player.playlist.onAdd(async (index, id) => { const related = v2r.get(id) || (await VideoInfo.getData(id)).related || [ ]; added.push({ id, related, }); update(); });
Player.playlist.onRemove((index, id) => { removed.push(id); update(); });
Promise.all(
	Player.playlist.map(async id => { const related = (await VideoInfo.getData(id)).related || [ ]; added.push({ id, related, }); })
).then(update).catch(notify.error);

return list;

}); })(this);
