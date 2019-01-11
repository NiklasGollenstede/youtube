/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ options, /*packageJson,*/ manifestJson, files, }) {

	manifestJson.permissions.push(
		'bookmarks',
		'clipboardWrite',
		'contextMenus',
		'notifications',
		'tabs',
		'webNavigation',
		'webRequest',
		'webRequestBlocking',
		'https://www.youtube.com/*', 'https://gaming.youtube.com/*',
		'https://i.ytimg.com/*', 'https://*.googlevideo.com/*'
	);

	!options.viewRoot && (options.viewRoot = options.chrome ? 'ytO.html' : 'ytO');

	manifestJson.options_ui.open_in_tab = true;

	manifestJson.browser_action.default_icon = manifestJson.icons;
	manifestJson.sidebar_action.open_at_install = false;

	manifestJson.commands = {
		MediaPlayPause: {
			suggested_key: { default: 'MediaPlayPause',	},
			description: 'Play/Pause the current video',
		},
		MediaNextTrack: {
			suggested_key: { default: 'MediaNextTrack',	},
			description: 'Play next video in playlist',
		},
		MediaPrevTrack: {
			suggested_key: { default: 'MediaPrevTrack',	},
			description: 'Play previous video in playlist',
		},
	};

	files.node_modules = [
		'es6lib/concurrent.js',
		'es6lib/dom.js',
		'es6lib/functional.js',
		'es6lib/network.js',
		'es6lib/object.js',
		'es6lib/observer.js',
		'es6lib/string.js',
		'multiport/index.js',
		'pbq/require.js',
		'regexpx/index.js',
		'video-plus/content/video.js',
		'video-plus/content/zoom.js',
		'web-ext-utils/browser/index.js',
		'web-ext-utils/browser/messages.js',
		'web-ext-utils/browser/storage.js',
		'web-ext-utils/browser/version.js',
		'web-ext-utils/loader/_background.html',
		'web-ext-utils/loader/_background.js',
		'web-ext-utils/loader/_view.html',
		'web-ext-utils/loader/_view.js',
		'web-ext-utils/loader/content.js',
		'web-ext-utils/loader/home.js',
		'web-ext-utils/loader/index.js',
		'web-ext-utils/loader/multiplex.js',
		'web-ext-utils/loader/views.js',
		'web-ext-utils/options/editor/about.css',
		'web-ext-utils/options/editor/about.js',
		'web-ext-utils/options/editor/dark.css',
		'web-ext-utils/options/editor/light.css',
		'web-ext-utils/options/editor/index.css',
		'web-ext-utils/options/editor/index.js',
		'web-ext-utils/options/editor/inline.js',
		'web-ext-utils/options/index.js',
		'web-ext-utils/update/index.js',
		'web-ext-utils/utils/icons/',
		'web-ext-utils/utils/event.js',
		'web-ext-utils/utils/files.js',
		'web-ext-utils/utils/index.js',
		'web-ext-utils/utils/notify.js',
		'web-ext-utils/utils/semver.js',
		'sortablejs/Sortable.js',
	];

};
