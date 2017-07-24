(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/regexpx/': { RegExpX, },
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/web-ext-utils/browser/version': { gecko, },
}) => { /* eslint-disable no-irregular-whitespace */

const isBeta = (/^\d+\.\d+.\d+(?!$)/).test((global.browser || global.chrome).runtime.getManifest().version); // version doesn't end after the 3rd number ==> bata channel

const model = {
	playlist: {
		title: `Playlist options`,
		description: ``,
		default: true,
		children: {
			theme: {
				default: 'dark',
				restrict: { match: (/^dark$|^light$/), },
				input: { type: 'menulist', prefix: `<b>Theme</b>`, options: [
					{ value: 'dark',     label: `Dark`, },
					{ value: 'light',    label: `Light`, },
				], },
			},
			loop: {
				default: true,
				restrict: { type: 'boolean', },
				input: { type: 'boolean', prefix: `<b>Loop<b>`, },
			},
		},
	},
	content: {
		title: `Page options`,
		description: ``,
		default: true,
		children: {
			displayRatings: {
				title: `Video ratings`,
				description: `Displays a video rating bar for every thumbnail and shows the view count and video age when the cursor hovers over the image. This needs to load a snippet of information from YouTube servers for every thumbnail and caches these to reduce the network load`,
				default: true,
				expanded: false,
				input: { type: 'boolean', },
				children: {
					totalLifetime: {
						title: `Cache lifetime (total)`,
						description: `Maximum absolute lifetime of cached global video information. Set to -1 to disable caching`,
						default: 7 * 24,
						restrict: { from: -1, to: 365 * 24, },
						input: { type: 'integer', suffix: 'hours', },
					},
					relativeLifetime: {
						title: `Cache lifetime (relative)`,
						description: `Global video information will be refreshed if it is older than a percentage of the video age`,
						default: 20,
						restrict: { from: 1, to: 1e5, },
						input: { type: 'integer', suffix: '%', },
					},
					likesColor: {
						title: `Like color`,
						default: '#00BB22',
						restrict: { match: (/^([A-z]{3,}|#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?)$/), },
						input: { type: 'color', },
					},
					dislikesColor: {
						title: `Dislike color`,
						default: '#CC0000',
						restrict: { match: (/^([A-z]{3,}|#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?)$/), },
						input: { type: 'color', },
					},
					barHeight: {
						title: `Rating bar height`,
						default: 2,
						restrict: { from: 0, to: 5, },
						inüut: { type: 'number', suffix: 'display pixel', },
					},
				},
			},
			animateThumbs: {
				title: `Animate thumbnails`,
				default: true,
				input: { type: 'boolean', suffix: `Let thumbnails loop through video preview images when hovered`, },
			},
			autoExpandLists: {
				title: `Automatically expand lists`,
				default: true,
				input: { type: 'boolean', suffix: `Automatically click the "Show/Load more"-button when scrolling to the end of a list`, },
			},
			comments: {
				title: `Show comments`,
				default: true,
				input: { type: 'boolean', },
			},
			hideRecommended: {
				title: `Hide "Recommended" videos`,
				default: true,
				input: { type: 'boolean', suffix: `Remove any videos that are "<i>Recommended</i> for you" from the list of <i>related</i> videos`, },
			},
			player: {
				title: `Player preferences`,
				description: ``,
				default: true,
				expanded: false,
				children: {
					defaultQualities: {
						title: `Playback Quality`,
						description: ``,
						default: [ 'hd1080', 'hd720', ],
						maxLength: 10,
						input: { type: 'menulist', options: [
							{ value: 'hd2160',	label:   `2160p | UHD 4k`, },
							{ value: 'hd1440',	label:   `1440p | Quad HD`, },
							{ value: 'hd1080',	label:   `1080p | Full HD`, },
							{ value: 'hd720',	label: `   720p | HD ready`, }, /* The three '\u2009' indent the <option>'s text to align the '|'s */
							{ value: 'large',	label: `   480p | large`, },
							{ value: 'medium',	label: `   360p | medium`, },
							{ value: 'small',	label: `   240p | small`, },
							{ value: 'tiny',	label: `   144p | tiny`, },
						], },
					},
					zoomFactor: {
						title: `Video zoom levels`,
						description: `Factor that each zooming will scale the video`,
						default: 10,
						restrict: { from: -50, to: 100, },
						input: { type: 'integer', suffix: '%', },
					},
					annotations: {
						title: `Display annotations`,
						default: false,
						input: { type: 'boolean', },
					},
					alwaysVolume: {
						title: `Always display volume`,
						description: `The volume bar won't disappear`,
						default: true,
						input: { type: 'boolean', },
					},
					onStart: {
						title: `Video start setting`,
						default: 'focused',
						input:{ type: 'menulist', prefix: `When the video starts`, options: [
							{ value: '', label: `keep playing (YouTube default)`, },
							{ value: 'pause', label: `pause playback but keep buffering`, },
							{ value: 'visible', label: `only pause if the tab is not visible`, },
							{ value: 'focused', label: `only pause if the tab is not focused`, },
						], },
						children: {
							stop: {
								title: `Stop`,
								description: `Stop the video instead of pausing. This prevents buffering`,
								default: false,
								input: { type: 'boolean', },
							},
						},
					},
					seamlessFullscreen: {
						title: `Enable seamless full screen`,
						description: `Hides the sidebar to display the video player across the entire browser window`,
						default: true,
						expanded: false,
						input: { type: 'boolean', },
						children: {
							atStart: {
								title: `Load in full screen mode`,
								description: `Full screen mode is enabled by default`,
								default: false,
								input: { type: 'boolean', },
							},
							showOnMouseRight: {
								title: `Right edge motion`,
								description: `Enables full screen mode when cursor is moved close to the right edge of the window`,
								default: 0,
								restrict: { from: 0, to: 100, },
								input: { type: 'integer', suffix: 'pixel', },
							},
							showOnScrollTop: {
								title: `Scroll to top`,
								description: `Enables full screen mode when scrolling to the very top of the page`,
								default: true,
								input: { type: 'boolean', },
							},
							hideOnScrollDown: {
								title: `Scroll down`,
								description: `Disables full screen when scrolling downwards`,
								default: true,
								input: { type: 'boolean', },
							},
						},
					},
					bypassAge: {
						title: `Bypass age restriction`,
						description: `Tries to load age restricted videos without the need to sign in to YouTube`,
						default: true,
						input: { type: 'boolean', },
					},
				},
			},
			keys: {
				title: `Keyboard shortcuts`,
				description: `To change a shortcut, focus the textbox and press any combination of the modifiers Alt, Command, Control and Shift plus another key. Note that some combinations may be reserved by the browser itself.<br>All key names are those of the standard English keyboard`,
				default: true,
				expanded: false,
				restrict: { match: (RegExpX`^ (?:Ctrl\+)? (?:Alt\+)? (?:Shift\+)? (?:
					  Key[A-Z]
					| F\d\d?
					| Digit\d
					| Numpad\d
					| Numpad(Subtract | Add | Decimal | Divide | Multiply | Enter | ChangeSign | Paren(Left | Right))
					| Minus | Equal
					| BracketLeft | BracketRight
					| Escape | Backspace | Enter | Tab
					| Control(Left | Right)
					| Shift(Left | Right) | CapsLock | NumLock
					| Alt(Left | Right)
					| OS(Left | Right)
					| Quote | Backquote
					| Slash | Backslash | IntlBackslash
					| Semicolon | Comma | Period
					| Space
					| Pause | ScrollLock | PrintScreen
					| Lang[12] | IntlYen
					| Undo | Paste | Cut | Copy
					| Media(PlayPause | Stop | Track(Previous | Next) | Select)
					| LaunchMail
					| Volume(Down | Up | Mute)
					| Eject | BrowserHome | Help
					| Insert | Delete
					| Home | End
					| PageUp | PageDown
					| Arrow(Up | Down | Left | Right)
					| ContextMenu
					| Power
					| Browser(Search | Favorites | Refresh | Stop | Forward | Back)
					| Launch(App1 | Mail)
				) $`), unique: '*', message: 'Please enter a valid key combination', },
				children: {
					openRelatedModifier: {
						title: `Open related Videos`,
						description: `Choose the modifier key to press alongside any of the number keys (top row) to load the corresponding video from the related videos list`,
						default: [ '', ],
						input: { type: 'menulist', options: [
							{ value: '<disabled>',   label: `[disabled]`, },
							{ value: '',             label: `[none]`, },
							{ value: 'Alt+',         label: `Alt`, },
							{ value: 'Ctrl+',        label: `Ctrl`, },
							{ value: 'Shift+',       label: `Shift`, },
						], },
					},
					videoIncreaseQuality: keybordKey({
						title: `Increase video quality`,
						description: ``,
						default: [ 'Ctrl+ArrowUp', 'Shift+BracketRight', 'Numpad8', ],
					}),
					videoDecreaseQuality: keybordKey({
						title: `Decrease video quality`,
						description: ``,
						default: [ 'Ctrl+ArrowDown', 'Shift+Slash', 'Numpad2', ],
					}),
					videoIncreaseSpeed: keybordKey({
						title: `Increase video speed`,
						description: ``,
						default: [ 'BracketRight', 'Numpad6', ],
					}),
					videoDecreaseSpeed: keybordKey({
						title: `Decrease video speed`,
						description: ``,
						default: [ 'Slash', 'Numpad4', ],
					}),
					videoTogglePause: keybordKey({
						title: `Play/pause`,
						description: `Toggles Play/Pause in the current tab. (For the global playlist play/pause see "Keyboard shortcuts" at the bottom of the "chrome://extensions" page)`,
						default: [ "Space", ],
					}),
					videoToggleFullscreen: keybordKey({
						title: `Full screen`,
						description: `Toggle YouTubes default full screen mode on/off`,
						default: [ "KeyF", ],
					}),
					videoPromptPosiotion: keybordKey({
						title: `Seek video to`,
						description: `Prompt for video position in hh:mm:SS.ss`,
						default: [ "KeyT", ],
					}),
					videoPromptVolume: keybordKey({
						title: `Set volume to`,
						description: `Prompt for video volume in %`,
						default: [ "KeyV", ],
					}),
					playlistNext: keybordKey({
						title: `Local playlist next`,
						description: `Play the next video in the YouTube playlist in the current tab. (For the global playlist Next command see "Keyboard shortcuts" at the bottom of the "chrome://extensions" page)`,
						default: [ 'KeyN', ],
					}),
					playlistPrevious: keybordKey({
						title: `Local playlist previous`,
						description: `Play the previous video in the YouTube playlist in the current tab. (For the global playlist Previous command see "Keyboard shortcuts" at the bottom of the "chrome://extensions" page)`,
						default: [ 'KeyP', ],
					}),
					playlistToggleShuffle: keybordKey({
						title: `Toggle local playlist shuffle`,
						description: ``,
						default: [ 'KeyS', ],
					}),
					playlistToggleLoop: keybordKey({
						title: `Toggle local playlist loop`,
						description: ``,
						default: [ 'KeyR', ],
					}),
					playlistClear: keybordKey({
						title: `Clear local playlist`,
						description: ``,
						default: [ 'KeyE', ],
					}),
					videoStop: keybordKey({
						title: `Stop video`,
						description: `Stop the YouTube player (stops buffering and discards all buffering progress)`,
						default: [ 'KeyQ', ],
					}),
					videoToggleMute: keybordKey({
						title: `Mute video`,
						description: ``,
						default: [ 'KeyM', ],
					}),
					videoToggleInfoScreen: keybordKey({
						title: `Display/hide the "Stats for nerds"`,
						description: ``,
						default: [ 'KeyI', ],
					}),
					videoPushScreenshot: keybordKey({
						title: `Take screenshot`,
						description: `Take a screenshot of the video at its current position in its native resolution and add it to the screenshot list in the sidebar`,
						default: [ 'KeyC', ],
					}),
					videoPopScreenshot: keybordKey({
						title: `Remove screenshot`,
						description: `Remove the topmost, oldest screenshot from the sidebar`,
						default: [ 'KeyX', 'Delete', ],
					}),
					videoSave: keybordKey({
						title: `Save video`,
						description: `Tries to save the current video, which will only work if the browser doesn't support DASH-playback and YouTube uses the 360p/720p-.mp4-fallback`,
						default: [ 'Ctrl+KeyS', ],
					}),
					videoDownloadCover: keybordKey({
						title: `Download video cover`,
						description: `Save the "maxresdefault" preview image of the video`,
						default: [ 'Ctrl+Alt+KeyS', 'Numpad5', ],
					}),
					videoAutoZoom: keybordKey({
						title: `Auto video zoom`,
						description: `Adjusts the video zoom so that black bars at the top and/or bottom are hidden. Useful to view 21:9 videos with black bars in full screen on 21:9 displays`,
						default: [ 'KeyZ', 'KeyA', ],
					}),
				},
			},
		},
	},
	incognito: {
		title: 'Private Mode',
		description: `Warning: When active, this will <b>record data</b> from YouTube tabs opened in <b>Private Browsing</b> windows on your computers disk!`,
		default: !gecko, /*hidden: !gecko,*/ // this is only relevant in Firefox, Chrome has a separate check box for this
		input: { type: 'boolean', suffix: `include tabs in Private Browsing windows`, },
	},
	storage: {
		title: `Storage options`,
		description: ``,
		default: true,
		expanded: false,
		children: {
			export: {
				title: `Export all collected data`,
				description: `Export all cache and user data (as JSON)`,
				default: true,
				input: [
					{ type: 'control', prefix: `All to     `,    label: `File`,      id: `all-file`, },
					{ type: 'control',                           label: `Clipboard`, id: `all-clipboard`, },
					{ type: 'control', prefix: `<br> Viewed to`, label: `File`,      id: `viewed-file`, },
					{ type: 'control',                           label: `Clipboard`, id: `viewed-clipboard`, },
				],
			},
			import: {
				title: `Import data`,
				description: `Imports JSON formatted data into the cache data / user data storage. Overwrites conflicting data`,
				default: true,
				input: [
					{ type: 'control', prefix: `From`,    label: `File`,      id: `from-file`, },
					{ type: 'control',                    label: `Clipboard`, id: `from-clipboard`, },
				],
			},
			getSize: {
				title: `Show data size`,
				default: true,
				input: { type: 'control', label: `Compute and Show`, suffix: `this may take a few seconds`, },
			},
			clear: {
				title: `Clear all collected data`,
				description: `Irrevocably deletes all cache data and user data, keeps the settings/options selected on this page`,
				default: true,
				input: { type: 'control', label: `Purge`, },
			},
		},
	},
	debug: {
		title: 'Debug Level',
		expanded: false,
		default: +isBeta,
		hidden: !isBeta,
		restrict: { type: 'number', from: 0, to: 2, },
		input: { type: 'integer', suffix: 'set to > 0 to enable debugging', },
	},
};

return (await new Options({ model, })).children;

function keybordKey(arg) {
	return Object.assign({ }, {
		maxLength: 5,
		expanded: false,
		restrict: 'inherit',
		input: { type: 'keybordKey', },
	}, arg);
}

}); })(this);
