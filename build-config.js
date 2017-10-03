/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ options, /*packageJson,*/ manifestJson, files, }) {

	manifestJson.permissions.push(
		'bookmarks',
		'clipboardWrite',
		'notifications',
		'tabs',
		'webNavigation',
		'https://www.youtube.com/*', 'https://gaming.youtube.com/*',
		'https://i.ytimg.com/*', 'https://*.googlevideo.com/*'
	);

	manifestJson.options_ui.open_in_tab = true;

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

	files['.'].push('lib/');

	files.node_modules = {
		es6lib: [
			'concurrent.js',
			'dom.js',
			'functional.js',
			'network.js',
			'object.js',
			'observer.js',
			'string.js',
		],
		regexpx: [
			'index.js',
		],
		'web-ext-utils': {
			'.': [
				'browser/',
				'loader/',
				'utils/',
				'lib/multiport/index.js',
				'lib/pbq/require.js',
			],
			options: {
				'.': [ 'index.js', ],
				editor: [
					'about.js',
					'about.css',
					'dark.css',
					'index.js',
					'index.css',
					'inline.js',
				],
			},
			update: [
				'index.js',
			],
		},
		sortablejs: [
			'Sortable.js',
		],
	};

	if (options.run && !(options.run.prefs === 0 || options.run.prefs === null)) {
		const run = typeof options.run === 'object' ? options.run
		: (options.run = { bin: typeof options.run === 'string' ? options.run : undefined, });
		const prefs = {
			'dom.webcomponents.enabled': true,
		};
		run.prefs ? Object.assign(run.prefs, prefs) : (run.prefs = prefs);
	}
};
