(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/notify': notify,
	'background/player': Player,
	'background/video-info': VideoInfo,
}) => async window => {

const off = { owner: window, };

window.document.body.insertAdjacentHTML('beforeend', `<style>
	html, body{ margin: 0; padding: 0; overflow: hidden; }
	video { width: 100vw; height: 100vh; background: black; }
</style><video></video>`);

const video = window.document.getElementsByTagName('video')[0];
video.defaultMuted = true; video.volume = 0;
video.addEventListener('click', event => !event.button && Player.toggle());
video.stop = function stop() { this.currentTime = 0; this.src = 'data:video/mp4;base64,'; this.removeAttribute('src'); };
let _id = null; Object.defineProperty(video, 'id', { set(id) {
	_id = id; id ? video.setAttribute('video-id', id) : video.removeAttribute('video-id');
}, get() { return _id; }, enumerable: true, });

Player.onDurationChange(load, off); async function load() {
	const id = Player.duration && Player.playlist.get() || null; if (id === video.id) { return; } // already loading that
	if (!id) { video.id = null; video.stop(); cancel && cancel(); return; }
	let stop = false; cancel && cancel(); cancel = () => { cancel = null; stop = true; }; {
		video.id = id; const url = (await getUrl(id)); if (stop) { return; } if (!url) { cancel = null; return; }
		video.src = url; video.currentTime = Player.currentTime; Player.playing && video.play();
	} cancel = null;
} let cancel = null;
video.addEventListener('error', event => {
	notify.warn(`Video playback error`, `reloading `+ video.id, video.error && (video.error.message || video.error.code), event);
	video.id = null; video.stop(); // load();
});

Player.onPlay(sync, off); Player.onSeek(sync, off); async function sync() {
	if (cancel) { return; } // currently loading other video
	(await Player.playing ? video.play() : video.pause());
	video.currentTime = Player.currentTime;
}
video.addEventListener('playing', () => {
	const diff = Player.currentTime - video.currentTime;
	console.log('playing', video.currentTime, Player.currentTime, diff);
	if (Math.abs(diff) < 1/16) { return; }
	video.currentTime = Player.currentTime + (diff < 1 && diff > 0 ? diff : 0);
});

async function getUrl(id) {
	let info = (await VideoInfo.getData(id));
	if (info.videoUrl && !info.error  && Date.now() - info.fetched < 12e5/*20 min*/) { return info.videoUrl; }
	(await VideoInfo.refresh(id));
	info = (await VideoInfo.getData(id));
	if (info.videoUrl && !info.error) { return info.videoUrl; }
	notify.error(`Failed to load audio`, `for YouTube video "${ info.title }" (${ id })`, info.error ? '\n'+ info.error : '');
	return null;
}

load();

}); })(this);
