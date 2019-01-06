(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/video-plus/content/video': VideoResizer,
	'node_modules/web-ext-utils/utils/notify': notify,
	'background/player': Player,
	'background/video-info': VideoInfo,
	'./playlist/events': Events,
}) => async ({ window, document, }) => {

Events.register(window);

const off = { owner: window, };

const stoppedTitle = document.title = '[stopped] – ytO Video Player';
document.body.insertAdjacentHTML('beforeend', `<style>
	html, body{ margin: 0; padding: 0; overflow: hidden; }
	video { width: 100vw; height: 100vh; background: black; }
	video { background-image: repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.05) 0px, rgba(255, 255, 255, 0.05) 2px, transparent 2px, transparent 4px ), repeating-linear-gradient(+45deg, rgba(255, 255, 255, 0.05) 0px, rgba(255, 255, 255, 0.05) 2px, transparent 2px, transparent 4px); }
</style><video></video>`);

const video = document.getElementsByTagName('video')[0];
video.defaultMuted = true; video.volume = 0;

let videoId = null; function setId(id) {
	videoId = id;
	id ? document.body.setAttribute('video-id', id) : document.body.removeAttribute('video-id');
	if (videoId == null) { stop(); return; }
}

function stop() {
	video.currentTime = 0; video.src = 'data:video/mp4;base64,'; video.removeAttribute('src');
	Object.assign(video.dataset, { type: '', x: '', y: '', fps: '', resolution: '', bitrate: '', });
}


Player.onDurationChange(load, off); async function load() {
	const id = Player.duration && Player.playlist.get() || null; if (id === videoId) { return; } // already loading that
	if (!id) { setId(null); cancel && cancel(); document.title = stoppedTitle; return; }
	let stop = false; cancel && cancel(); cancel = () => { cancel = null; stop = true; }; {
		setId(id); const info = (await getInfo(id)); if (stop) { return; } if (!info) { cancel = null; return; }
		video.src = info.video.url; video.currentTime = Player.currentTime; Player.playing && video.play();
		Object.assign(video.dataset, info.video, { url: '', });
		document.title = info.title +' – ytO Video Player';
	} cancel = null;
} let cancel = null;


video.addEventListener('error', event => {
	notify.warn(`Video playback error`, `reloading `+ videoId, video.error && (video.error.message || video.error.code), event);
	setId(null); // load();
});

Player.onPlay(sync, off); Player.onSeek(sync, off); async function sync() {
	if (!videoId || cancel) { return; } // no video loaded
	if (Player.playing && video.paused) {
		video.currentTime = Player.currentTime;
		(await video.play());
	} else if (!Player.playing && !video.paused) {
		(await video.pause());
		videoId && !cancel && (video.currentTime = Player.currentTime);
	} else { adjustTime(); }
}
video.addEventListener('playing', adjustTime); function adjustTime() {
	const diff = Player.currentTime - video.currentTime;
	console.log('playing', video.currentTime, Player.currentTime, diff);
	if (Math.abs(diff) < 1/16) { return; }
	video.currentTime = Player.currentTime + (diff < 1 && diff > 0 ? diff : 0);
}

async function getInfo(id) {
	let info = (await VideoInfo.getData(id));
	if (info.video && info.video.url && !info.error  && Date.now() - info.fetched < 12e5/*20 min*/) { return info; }
	(await VideoInfo.refresh(id));
	info = (await VideoInfo.getData(id));
	if (info.video && info.video.url && !info.error) { return info; }
	notify.error(`Failed to load audio`, `for YouTube video "${ info.title }" (${ id })`, info.error ? '\n'+ info.error : '');
	return null;
}

load();
new VideoResizer(video, { transitionDuration: 5000, });


/*
function proxyUrl(url) {
// Need to be specific for Blink regarding codecs
// ./mp4info frag_bunny.mp4 | grep Codec

if (!MediaSource.isTypeSupported(info.video.type)) { return; } // meh

var mediaSource = new MediaSource;
// console.log(mediaSource.readyState); // closed

mediaSource.addEventListener('sourceopen', () => {
	// console.log(this.readyState); // open
	var sourceBuffer = mediaSource.addSourceBuffer(info.video.type);

	sourceBuffer.addEventListener('updateend', function (_) {
		mediaSource.endOfStream();
		video.play();
		// console.log(mediaSource.readyState); // ended
	});

	sourceBuffer.appendBuffer(await fetch(assetURL));
});

video.src = URL.createObjectURL(mediaSource);

}*/

}); })(this);
