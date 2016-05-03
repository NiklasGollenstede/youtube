'use strict'; define('web/downloader', [
], function(
) {

return function() { 'use strict'; // TODO test if 'use strict' is necessary when decompiling

var exports = window;

var QueryObject = exports.QueryObject = function QueryObject(query, key, value, decoder) {
	value = value || '='; decoder = decoder || function(id) { return id; };
	const self = (this instanceof QueryObject) ? this : Object.create(QueryObject.prototype);
	String.prototype.split.call(query, key || (/[&#?]+/))
	.map(function(string) { return string.split(value); })
	.forEach(function(pair) { pair[0] && (self[pair[0]] = decoder(pair[1])); });
};
QueryObject.prototype.toString = function(keySep, valueSep, encoder) {
	const self = this;
	valueSep = valueSep || '='; encoder = encoder || function(id) { return id; };
	return Object.keys(self).map(function(key) {
		return key + valueSep + (self[key] !== null ? encoder(self[key]) : '');
	}).join(keySep || '&');
};



var saveAs = exports.saveAs = function saveAs(content, name) {
	const isBlob = typeof content.type === 'string';

	const link = Object.assign(document.createElement('a'), {
		download: name,
		target: '_blank', // fallback
		href: isBlob ? window.URL.createObjectURL(content) : content,
	});

	const event = document.createEvent('MouseEvents');
	event.initEvent('click', true, true);
	link.dispatchEvent(event);

	isBlob && setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

	const Self = new WeakMap;
	window.requests = [ ];

	const XMLHttpRequest = window.XMLHttpRequest;

	window.XMLHttpRequest = function() { // side effect: XMLHttpRequest() is not instanceof XMLHttpRequest
		const _this = new XMLHttpRequest(...arguments);
		const self = {
			request: {
				xhr: _this,
				method: null,
				url: null,
				user: null,
				password: null,
				headers: { },
				data: null,
				timestamp: NaN,
			},
			response: {
				redirect: false,
				headers: { },
				data: null,
				type: null,
				timestamp: NaN,
			},
		};
		Self.set(_this, self);
		// self.stack = new Error().stack;
		_this.addEventListener('load', event => {
			self.response.data = _this.response;
			self.response.redirect = _this.responseURL !== self.request.url && _this.responseURL;
			_this.getAllResponseHeaders().split(/\r?\n|\r/g).map(string => string.split(/:[ \t]+/)).forEach(pair => pair[0] && (self.response.headers[pair[0]] = pair[1]));
			self.response.type = self.response.headers['content-type'];
			self.response.timestamp = Date.now();

			console.log('XHR', self);
			window.requests.push(Object.freeze(self));
		});
		return _this;
	};

	const setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
	XMLHttpRequest.prototype.setRequestHeader = function(key, value) {
		const self = Self.get(this);
		setRequestHeader.apply(this, arguments);
		self.request.headers[key] = value;
	};

	const open = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function(method, url, bool, user, password) {
		const self = Self.get(this);
		open.apply(this, arguments);
		self.request.method = method;
		self.request.url = url;
		self.request.user = user;
		self.request.password = password;
		self.request.query = new QueryObject(url.replace(/^.*\?/, ''), '&', '=', decodeURIComponent);
		self.request.path = url.replace(/\?.*$/, '');
		self.request.timestamp = Date.now();
	};

	function log() { console.log(...arguments); return arguments[arguments.length - 1]; }

var HttpRequest = window.HttpRequest = function HttpRequest(url, options) {
	var request, cancel;
	const o = arguments[arguments.length - 1] || { };
	const promise = new Promise(function(resolve, reject) {
		typeof url !== 'string' && (url = o.url || o.src);

		request = new XMLHttpRequest(o);
		cancel = cancelWith.bind(request, reject);

		request.open(o.method || "get", url, true, o.user, o.password);

		o.responseType && (request.responseType = o.responseType);
		o.timeout && (request.timeout = o.timeout);
		o.overrideMimeType && request.overrideMimeType(o.overrideMimeType);
		(o.xhr == null || o.xhr) && request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		o.header && Object.keys(o.header).forEach(function(key) { request.setRequestHeader(key, o.header[key]); });

		request.onerror = reject;
		request.ontimeout = reject;
		request.onload = function(event) {
			if (request.status >= 200 && request.status < 300) {
				resolve(request);
			} else {
				cancel('bad status');
			}
		};
		request.send(o.body);
	});
	o.needAbort && (promise.abort = function() {
		request.abort();
		cancel('canceled');
	});
	return promise;
};
function cancelWith(reject, reason) {
	const error = new ProgressEvent(reason);
	this.dispatchEvent(error);
	reject(error);
}

var mimeTypes = window.mimeTypes = {
	'3gp': 'video/3gpp',
	bmp: 'image/bmp',
	css: 'text/css',
	htm: 'text/html',
	flv: 'video/x-flv',
	gif: 'image/gif',
	html: 'text/html',
	ico: 'image/x-icon',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	js: 'application/javascript',
	json: 'application/json',
	mp4: 'video/mp4',
	pdf: 'application/pdf',
	png: 'image/png',
	svg: 'image/svg+xml',
	ttf: 'application/octet-stream',
	txt: 'text/plain',
	webm: 'video/webm',
	woff2: 'application/font-woff2',
	woff: 'application/font-woff',
	xhtml: 'application/xhtml+xml',
};

	// extract from https://github.com/rg3/youtube-dl/blob/f3a58d46bf969b33910479a3a6096635e793a553/youtube_dl/extractor/youtube.py
	var formats = window.formats = [
		{ itag: 5, ext: 'flv', width: 400, height: 240, acodec: 'mp3', abr: 64, vcodec: 'h263', },
		{ itag: 6, ext: 'flv', width: 450, height: 270, acodec: 'mp3', abr: 64, vcodec: 'h263', },
		{ itag: 13, ext: '3gp', acodec: 'aac', vcodec: 'mp4v', },
		{ itag: 17, ext: '3gp', width: 176, height: 144, acodec: 'aac', abr: 24, vcodec: 'mp4v', },
		{ itag: 18, ext: 'mp4', width: 640, height: 360, acodec: 'aac', abr: 96, vcodec: 'h264', },
		{ itag: 22, ext: 'mp4', width: 1280, height: 720, acodec: 'aac', abr: 192, vcodec: 'h264', },
		{ itag: 34, ext: 'flv', width: 640, height: 360, acodec: 'aac', abr: 128, vcodec: 'h264', },
		{ itag: 35, ext: 'flv', width: 854, height: 480, acodec: 'aac', abr: 128, vcodec: 'h264', },
		// itag 36 videos are either 320x180 (BaW_jenozKc) or 320x240 (__2ABJjxzNo), abr varies as well
		{ itag: 36, ext: '3gp', width: 320, acodec: 'aac', vcodec: 'mp4v', },
		{ itag: 37, ext: 'mp4', width: 1920, height: 1080, acodec: 'aac', abr: 192, vcodec: 'h264', },
		{ itag: 38, ext: 'mp4', width: 4096, height: 3072, acodec: 'aac', abr: 192, vcodec: 'h264', },
		{ itag: 43, ext: 'webm', width: 640, height: 360, acodec: 'vorbis', abr: 128, vcodec: 'vp8', },
		{ itag: 44, ext: 'webm', width: 854, height: 480, acodec: 'vorbis', abr: 128, vcodec: 'vp8', },
		{ itag: 45, ext: 'webm', width: 1280, height: 720, acodec: 'vorbis', abr: 192, vcodec: 'vp8', },
		{ itag: 46, ext: 'webm', width: 1920, height: 1080, acodec: 'vorbis', abr: 192, vcodec: 'vp8', },
		{ itag: 59, ext: 'mp4', width: 854, height: 480, acodec: 'aac', abr: 128, vcodec: 'h264', },
		{ itag: 78, ext: 'mp4', width: 854, height: 480, acodec: 'aac', abr: 128, vcodec: 'h264', },


		// 3D videos
		{ itag: 82, ext: 'mp4', height: 360, note: '3D', acodec: 'aac', abr: 128, vcodec: 'h264', preference: -20},
		{ itag: 83, ext: 'mp4', height: 480, note: '3D', acodec: 'aac', abr: 128, vcodec: 'h264', preference: -20},
		{ itag: 84, ext: 'mp4', height: 720, note: '3D', acodec: 'aac', abr: 192, vcodec: 'h264', preference: -20},
		{ itag: 85, ext: 'mp4', height: 1080, note: '3D', acodec: 'aac', abr: 192, vcodec: 'h264', preference: -20},
		{ itag: 100, ext: 'webm', height: 360, note: '3D', acodec: 'vorbis', abr: 128, vcodec: 'vp8', preference: -20},
		{ itag: 101, ext: 'webm', height: 480, note: '3D', acodec: 'vorbis', abr: 192, vcodec: 'vp8', preference: -20},
		{ itag: 102, ext: 'webm', height: 720, note: '3D', acodec: 'vorbis', abr: 192, vcodec: 'vp8', preference: -20},

		// Apple HTTP Live Streaming
		{ itag: 91, ext: 'mp4', height: 144, note: 'HLS', acodec: 'aac', abr: 48, vcodec: 'h264', preference: -10},
		{ itag: 92, ext: 'mp4', height: 240, note: 'HLS', acodec: 'aac', abr: 48, vcodec: 'h264', preference: -10},
		{ itag: 93, ext: 'mp4', height: 360, note: 'HLS', acodec: 'aac', abr: 128, vcodec: 'h264', preference: -10},
		{ itag: 94, ext: 'mp4', height: 480, note: 'HLS', acodec: 'aac', abr: 128, vcodec: 'h264', preference: -10},
		{ itag: 95, ext: 'mp4', height: 720, note: 'HLS', acodec: 'aac', abr: 256, vcodec: 'h264', preference: -10},
		{ itag: 96, ext: 'mp4', height: 1080, note: 'HLS', acodec: 'aac', abr: 256, vcodec: 'h264', preference: -10},
		{ itag: 132, ext: 'mp4', height: 240, note: 'HLS', acodec: 'aac', abr: 48, vcodec: 'h264', preference: -10},
		{ itag: 151, ext: 'mp4', height: 72, note: 'HLS', acodec: 'aac', abr: 24, vcodec: 'h264', preference: -10},

		// DASH mp4 video
		{ itag: 133, ext: 'mp4', height: 240, note: 'DASH video', vcodec: 'h264', preference: -40},
		{ itag: 134, ext: 'mp4', height: 360, note: 'DASH video', vcodec: 'h264', preference: -40},
		{ itag: 135, ext: 'mp4', height: 480, note: 'DASH video', vcodec: 'h264', preference: -40},
		{ itag: 136, ext: 'mp4', height: 720, note: 'DASH video', vcodec: 'h264', preference: -40},
		{ itag: 137, ext: 'mp4', height: 1080, note: 'DASH video', vcodec: 'h264', preference: -40},
		{ itag: 138, ext: 'mp4', note: 'DASH video', vcodec: 'h264', preference: -40},  // Height can vary (https://github.com/rg3/youtube-dl/issues/4559)
		{ itag: 160, ext: 'mp4', height: 144, note: 'DASH video', vcodec: 'h264', preference: -40},
		{ itag: 264, ext: 'mp4', height: 1440, note: 'DASH video', vcodec: 'h264', preference: -40},
		{ itag: 298, ext: 'mp4', height: 720, note: 'DASH video', vcodec: 'h264', fps: 60, preference: -40},
		{ itag: 299, ext: 'mp4', height: 1080, note: 'DASH video', vcodec: 'h264', fps: 60, preference: -40},
		{ itag: 266, ext: 'mp4', height: 2160, note: 'DASH video', vcodec: 'h264', preference: -40},

		// Dash mp4 audio
		{ itag: 139, ext: 'm4a', note: 'DASH audio', acodec: 'aac', abr: 48, preference: -50, container: 'm4a_dash', },
		{ itag: 140, ext: 'm4a', note: 'DASH audio', acodec: 'aac', abr: 128, preference: -50, container: 'm4a_dash', },
		{ itag: 141, ext: 'm4a', note: 'DASH audio', acodec: 'aac', abr: 256, preference: -50, container: 'm4a_dash', },

		// Dash webm
		{ itag: 167, ext: 'webm', height: 360, width: 640, note: 'DASH video', container: 'webm', vcodec: 'vp8', preference: -40},
		{ itag: 168, ext: 'webm', height: 480, width: 854, note: 'DASH video', container: 'webm', vcodec: 'vp8', preference: -40},
		{ itag: 169, ext: 'webm', height: 720, width: 1280, note: 'DASH video', container: 'webm', vcodec: 'vp8', preference: -40},
		{ itag: 170, ext: 'webm', height: 1080, width: 1920, note: 'DASH video', container: 'webm', vcodec: 'vp8', preference: -40},
		{ itag: 218, ext: 'webm', height: 480, width: 854, note: 'DASH video', container: 'webm', vcodec: 'vp8', preference: -40},
		{ itag: 219, ext: 'webm', height: 480, width: 854, note: 'DASH video', container: 'webm', vcodec: 'vp8', preference: -40},
		{ itag: 278, ext: 'webm', height: 144, note: 'DASH video', container: 'webm', vcodec: 'vp9', preference: -40},
		{ itag: 242, ext: 'webm', height: 240, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 243, ext: 'webm', height: 360, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 244, ext: 'webm', height: 480, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 245, ext: 'webm', height: 480, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 246, ext: 'webm', height: 480, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 247, ext: 'webm', height: 720, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 248, ext: 'webm', height: 1080, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 271, ext: 'webm', height: 1440, note: 'DASH video', vcodec: 'vp9', preference: -40},
		// itag 272 videos are either 3840x2160 (e.g. RtoitU2A-3E) or 7680x4320 (sLprVF6d7Ug)
		{ itag: 272, ext: 'webm', height: 2160, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 302, ext: 'webm', height: 720, note: 'DASH video', vcodec: 'vp9', fps: 60, preference: -40},
		{ itag: 303, ext: 'webm', height: 1080, note: 'DASH video', vcodec: 'vp9', fps: 60, preference: -40},
		{ itag: 308, ext: 'webm', height: 1440, note: 'DASH video', vcodec: 'vp9', fps: 60, preference: -40},
		{ itag: 313, ext: 'webm', height: 2160, note: 'DASH video', vcodec: 'vp9', preference: -40},
		{ itag: 315, ext: 'webm', height: 2160, note: 'DASH video', vcodec: 'vp9', fps: 60, preference: -40},

		// Dash webm audio
		{ itag: 171, ext: 'webm', acodec: 'vorbis', note: 'DASH audio', abr: 128, preference: -50},
		{ itag: 172, ext: 'webm', acodec: 'vorbis', note: 'DASH audio', abr: 256, preference: -50},

		// Dash webm audio with opus inside
		{ itag: 249, ext: 'webm', note: 'DASH audio', acodec: 'opus', abr: 50, preference: -50},
		{ itag: 250, ext: 'webm', note: 'DASH audio', acodec: 'opus', abr: 70, preference: -50},
		{ itag: 251, ext: 'webm', note: 'DASH audio', acodec: 'opus', abr: 160, preference: -50},

		// RTMP (unnamed)
		{ itag: '_rtmp', protocol: 'rtmp', },
	];

	// e.g.: selectFormat({ filter: { ext: { is: 'mp4', }, height: { within: [ 0, 1080, ], }, note: { mismatch: /hls|3d/i, }, }, select: { key: 'abr', }, })
	function selectFormat({ filter, select, }) {
		return formats.filter(format => Object.keys(filter).every(key => ({
			within({ within, }) { return format[key] && format[key] >= within[0] && format[key] <= within[1]; },
			include({ include, }) { return include.includes(format[key]); },
			exclude({ exclude, }) { return !exclude.includes(format[key]); },
			is({ is, }) { return is === format[key]; },
			match({ match, }) { return format[key] && match.test(format[key]); },
			mismatch({ mismatch, }) { return !format[key] || !mismatch.test(format[key]); },
		})[Object.keys(filter[key])[0]](filter[key])))
		.reduce((a, b) => ((a[select.key] || 0) - (b[select.key] || 0)) * (select.desc ? -1 : 1) > 0 ? a : b);
	}

	window.download = function({ format: { itag, ext, }, name, upn, }) {
		const audio = window.requests
		.filter(r => r.request.query.itag === itag)
		.filter(r => r.request.query.upn === upn)
		.map(r => ({
			from: +r.request.query.range.split('-')[0],
			to: +r.request.query.range.split('-')[1],
			data: r.response.data,
		}))
		.sort((a, b) => a.from - b.from);
		console.log('before', audio.slice());
		for (let i = 1; i < audio.length - 1; ++i) {
			const diff = audio[i - 1].to + 1 - audio[i].from;
			if (diff < 0) { throw new Error ('Missing range ('+ (audio[i - 1].to + 1) +', '+ audio[i].from +') at '+ i); }
			if (diff > 0) {
				if (diff >= audio[i].data.byteLength) {
					console.log('removing', i, audio[i]);
					audio.splice(i, 1);
					i--;
				} else {
					console.log('splicing', i, diff, audio[i]);
					audio.splice(i, 1, {
						data: audio[i].data.slice(diff),
						from: audio[i].from + diff,
						to: audio[i].to,
					});
				}
			}
		}
		console.log('after', audio);
		const blob = new Blob(audio.map(a => a.data), { type: mimeTypes[ext], });
		saveAs(blob, name +'.'+ ext);
	};


	console.log('XHR logger injected');
};

});
