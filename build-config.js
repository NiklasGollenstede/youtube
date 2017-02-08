/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ /*options, packageJson,*/ manifestJson, files, }) {

	manifestJson.permissions.push(
		'clipboardWrite',
		'notifications',
		'tabs',
		'https://www.youtube.com/*', 'https://gaming.youtube.com/*', 'https://i.ytimg.com/*'
	);

	manifestJson.options_ui = {
		page: 'ui/options/index.html',
		open_in_tab: true,
	};

	manifestJson.content_scripts = [ {
		matches: [ 'https://www.youtube.com/*', 'https://gaming.youtube.com/*', ],
		js: [
			'node_modules/es6lib/require.js',
			'node_modules/es6lib/concurrent.js',
			'node_modules/es6lib/dom.js',
			'node_modules/es6lib/functional.js',
			'node_modules/es6lib/namespace.js',
			'node_modules/es6lib/network.js',
			'node_modules/es6lib/object.js',
			'node_modules/es6lib/observer.js',
			'node_modules/es6lib/port.js',
			'node_modules/es6lib/string.js',
			'node_modules/web-ext-utils/browser/index.js',
			'node_modules/web-ext-utils/browser/version.js',
			'node_modules/web-ext-utils/options/index.js',
			'common/event-emitter.js',

			// these need to be in dependency order
			'content/layout-new.css.js',
			'content/layout-old.css.js',
			'content/player.js.js',
			'content/utils.js',
			'content/templates.js',
			'content/player.js',
			'content/ratings.js',
			'content/passive.js',
			'content/actions.js',
			'content/layout.js',
			'content/control.js',
			'content/options.js',
			'content/index.js',
		],
		css: [ ],
		all_frames: false,
		run_at: 'document_start',
	}, ];

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

	files.node_modules = {
		es6lib: [
			'concurrent.js',
			'dom.js',
			'functional.js',
			'index.js',
			'namespace.js',
			'network.js',
			'object.js',
			'observer.js',
			'port.js',
			'require.js',
			'string.js',
		],
		regexpx: [
			'index.js',
		],
		'web-ext-utils': {
			'.': [
				'browser/',
				'loader/',
			],
			options: {
				'.': [ 'index.js', ],
				editor: [
					'about.js',
					'about.css',
					'dark.css',
					'index.js',
					'index.css',
				],
			},
			update: [
				'index.js',
			],
			utils: [
				'files.js',
				'index.js',
				//	'inject.js',
				'semver.js',
			],
		},
		sortablejs: [
			'Sortable.min.js',
		],
	};

};
