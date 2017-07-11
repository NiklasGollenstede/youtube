(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/messages': messages,
	'node_modules/web-ext-utils/loader/content': { onUnload, connect, },
	'node_modules/es6lib/concurrent': { sleep, before, },
	'node_modules/es6lib/dom':  { createElement, getParent, },
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/es6lib/observer':  { RemoveObserver, },
	'node_modules/es6lib/port': Port,
	'common/event-emitter': EventEmitter,
	dom,
	Templates,
	'./player.js': playerJS,
	require,
	exports,
}) => { /* globals document, location, WheelEvent, MutationObserver, URLSearchParams, */

// table of public members, which all remotely call methods in ./player.js.js
const player = { }; [
	'play',
	'pause',
	'togglePlayPause',
	'end',
	'stop',
	'start',
	'next',
	'previous',
	'seekTo',
	'volume',
	'mute',
	'unMute',
	'toggleMute',
	'setQuality',
	'getQuality',
	'setSpeed',
	'getSpeed',
	'isMuted',
	'getTime',
	'getInfo',
	'getLoaded',
	'showVideoInfo',
	'hideVideoInfo',
].forEach(method => (player[method] = (exports[method] = async function(...args) {
	console.log('Player request', method, ...args);
	return (await getContent).request(method, ...args).then(value => { console.log('player resolve', method, value); return value; });
})));

const events = new EventEmitter;
[ 'on', 'once', 'off', 'promise', ].forEach(method => (exports[method] = function() { return events[method](...arguments); }));

let video = null; // the current <video> element
let root = null; // the current root element of the html5-video-player
let suspended = [ ];
let loaded = null;

Object.defineProperty(exports, 'video', { get() { return video; }, enumerable: true, });
Object.defineProperty(exports, 'root', { get() { return root; }, enumerable: true, });
Object.defineProperty(exports, 'loaded', { get() { return loaded; }, enumerable: true, });

{ // Firefox tends to send unnecessary url updates
	let old = location.href;
	messages.addHandler(function navigated(url) { old !== url && events._emitSync('navigated', old = url); });
}

const getOptions = require.async('./options');

const getBackground = connect('player').then(bg => bg
	.addHandler((/^(?:on|once|off|promise)$/), (name, ...args) => events[name](...args))
	.addHandler((/./), async (name, ...args) => {
		const method = bg.isRequest() ? 'request' : 'post';
		return (await getContent)[method](name, ...args);
	})
);

const getContent = new Promise((resolve, reject) => {
	// inject unsafe script
	const frame = document.documentElement.appendChild(createElement('iframe', { style: { display: 'none', }, }));
	frame.contentWindow.addEventListener('message', event => { try {
		const content = new Port(event.ports[0], Port.MessagePort)
		.addHandler(function emit() { loaded && events._emitSync(...arguments); })
		.addHandler('focusTabTemporary', () => messages.post('focusTabTemporary'))
		.addHandler('replyAfter', time => messages.request('replyAfter', time));
		onUnload.addListener(() => { content.post('destroy'); frame.remove(); }); // removing the iframe closes the channel
		resolve(content);
	} catch (error) { reject(error); } });
	document.documentElement.appendChild(createElement('script', { textContent: playerJS, })).remove();
});

Promise.all([ require.async('./observer'), getContent, ]).then(([ Observer, ]) => {
	Observer.all('.html5-video-player', initPlayer);
	Observer.all('#watch7-player-age-gate-content', loadExternalPlayer.bind(null, { reason: 'age', }));
});

onUnload.addListener(() => {
	events._destroy(new Error('Player was destroyed'));
	removePlayer();
});

function onVisibilitychange(event) {
	if (document.hidden || !root) { return; }
	root.dataset.visible = true;
	dom.off(document, 'visibilitychange', onVisibilitychange, false);
}

function initPlayer(element) {
	root && suspendPlayer();
	getContent.then(_=>_.post('initPlayer', element.ownerDocument !== document));
	root = element;
	video = element.querySelector('video');
	events._emit('loaded', element);
	RemoveObserver.on(root, removePlayer);
	if (!element.dataset.visible) {
		if (document.hidden) {
			dom.on(document, 'visibilitychange', onVisibilitychange, false);
		} else {
			element.dataset.visible = true;
		}
	}
}

function removePlayer() {
	if (!root) { return; }
	events._emit('unloaded', root);
	RemoveObserver.off(root, removePlayer);
	dom.off(document, 'visibilitychange', onVisibilitychange, false);
	root = video = null;
	suspended.length && initPlayer(suspended.pop());
}

function suspendPlayer() {
	if (!root) { return; }
	const old = root;
	const backup = suspended.concat(old);
	RemoveObserver.on(old, () => (suspended = suspended.filter(_=>_ !== old)));
	suspended = [ ];
	removePlayer();
	suspended = backup;
}

async function loadExternalPlayer({ reason, } = { }) {
	if (reason === 'age' && !(await getOptions).player.children.bypassAge.value) { return; }
	removePlayer(); // suspend instead?
	const videoId = new global.URL(global.location).searchParams.get('v');
	document.querySelector('#player-unavailable').classList.add('hid');
	const container = document.querySelector('#player-api');
	container.classList.remove('off-screen-target');
	container.innerHTML = Templates.youtubeIframe(videoId);
	const iframe = container.querySelector('#external_player');

	// call initPlayer
	iframe.onload = (() => {
		const cd = iframe.contentDocument;
		const element = cd.querySelector('.html5-video-player');
		if (element) {
			initPlayer(element);
		} else {
			const observer = new MutationObserver(mutations => mutations.forEach(({ addedNodes, }) => Array.prototype.forEach.call(addedNodes, element => {
				if (!element.matches || !element.matches('.html5-video-player')) { return; }
				observer.disconnect();
				initPlayer(element);
			})));
			observer.observe(cd, { subtree: true, childList: true, });
		}

		// catch link clicks
		cd.addEventListener('mousedown', ({ target, button, }) => !button && target.matches && target.matches('a *, a') && (location.href = getParent(target, 'a').href));
		// forward mouse wheel events (bug in Firefox?)
		cd.addEventListener('wheel', event => { iframe.dispatchEvent(new WheelEvent('wheel', event)); event.stopPropagation(); event.ctrlKey && event.preventDefault(); });
	});

	// load related videos
	const target = document.getElementById('watch7-sidebar-modules');
	const data = new URLSearchParams((await (await global.fetch('https://www.youtube.com/get_video_info?asv=3&hl=en_US&video_id='+ videoId)).text()));
	if (data.get('status') !== 'ok') { target.innerHTML = `<h4>Can't load related videos</h4>`; return; }

	const related = data.get('rvs').split(',').map(parseQuery).map(Templates.relatedVideoListItem);
	target.innerHTML = Templates.relatedVideoList(related);
}

function parseQuery(query) {
	const data = { }; for (const [ key, value, ] of new URLSearchParams(query)) {
		data[key] = value;
	} return data;
}

async function setQuality() {
	let quality, _try = 0; while (
		!(quality = (await exports.getQuality()))
		|| quality.current === 'unknown'
	) {
		if (++_try > 30) { return; }
		(await sleep(33 + 10 * _try));
	}
	const wanted = ((await getOptions).player.children.defaultQualities.values.current).find(level => quality.available.includes(level));
	if (!wanted || wanted === "auto") { return; }
	if (wanted !== quality.current) {
		(await player.setQuality(wanted));
	} else {
		player.setQuality(wanted);
	}
}

// set initial video quality and playback state according to the options and report to the background script
async function onNavigated() {
	const videoId = new global.URL(global.location).searchParams.get('v');
	if (loaded !== null) {
		console.log('player removed');
		events._emit('removed');
	}
	if (!videoId) { loaded = null; return; }

	if (!root && (await before(events.promise('navigated'), events.promise('loaded', 'unloaded')))) { return void console.log('cancel navigation'); }
	console.log('player loaded', videoId);
	messages.post('muteTab');
	const options = (await getOptions);

	// play, stop or pause
	const should = options.player.children.onStart.value;
	const play = !should
	|| should === 'visible' && !document.hidden
	|| should === 'focused' && document.hasFocus();
	if (play) {
		console.log('control at load: play');
		(await setQuality());
		(await player.play(false)) < 20 && (await player.seekTo(0));
	} else if (
		options.player.children.onStart.children.stop.value
		&& (await player.getLoaded()) < 0.5
	) {
		console.log('control at load: stop');
		(await player.stop());
	} else {
		console.log('control at load: pause');
		(await setQuality());
		(await player.pause(false)) < 20 && (await player.seekTo(0));
	}

	!play && (video.volume = 0);
	!play && events.once('playing', () => player.unMute());
	messages.post('unmuteTab');

	console.log('control done', videoId);
	loaded = videoId;
	(await waitForStart);
	events._emit('created', videoId);
	play && events._emit('playing', video.currentTime || 0);
}

const waitForStart = new Promise(start => getBackground.then(_=>_.addHandler('start', start)));
events.on('playing', debounce(setQuality, 1000));
events.on('navigated', onNavigated);
onNavigated();

Object.freeze(exports);

}); })(this);
