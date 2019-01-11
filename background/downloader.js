(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { WebRequest, },
	'./lib/ytdl': ytdl,
}) => {

const ownUrl = global.location.href;

const defaultHeaders = [
	{ name: 'User-Agent', value: 'Wget/1.12', },
	{ name: 'Accept', value: '*/*', },
	{ name: 'Host', value: 'www.youtube.com', },
	{ name: 'Connection', value: 'Keep-Alive', },
];

WebRequest.onBeforeSendHeaders.addListener(
	function rewriteUserAgentHeader({ originUrl, /*method, url, requestHeaders,*/ }) {
		// console.log(method, url, originUrl, requestHeaders);
		if (originUrl !== ownUrl) { return null; }
		return { requestHeaders: defaultHeaders, };
	},
	{ urls: [ 'https://www.youtube.com/watch?v=*', ], types: [ 'xmlhttprequest', ], },
	[ 'blocking', 'requestHeaders', ],
);

return ytdl;

}); })(this);
