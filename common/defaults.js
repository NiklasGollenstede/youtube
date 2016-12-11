(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/regexpx/': { RegExpX, },
}) {

return Object.freeze([ // TODO: deepFreeze
	{
		name: "debug",
		type: "hidden",
		default: true,
	}, {
		name: "panel",
		title: "Panel options",
		description: "",
		type: "label",
		default: true,
		children: {
			theme: {
				title: 'Theme',
				default: 'dark',
				type: 'menulist',
				options: [
					{ value: 'dark',     label: `Dark`, },
					{ value: 'light',    label: `Light`, },
				],
				restrict: { match: (/^dark$|^light$/), },
			},
		},
	}, {
		name: "content",
		title: "Page options",
		description: "",
		type: "label",
		default: true,
		children: [
			{
				name: "displayRatings",
				title: "Video ratings",
				description: "Displays a video rating bar for every thumbnail and shows the view count and video age when the cursor hovers over the image. This needs to load a snippet of information from YouTube servers for every thumbnail and caches these to reduce the network load",
				type: "bool",
				default: true,
				expanded: false,
				children: [
					{
						name: "totalLifetime",
						title: "Cache lifetime (total)",
						description: "Maximum absolute lifetime of cached global video information. Set to -1 to disable caching",
						type: "integer",
						restrict: { from: -1, to: 365 * 24, },
						suffix: "hours",
						default: 7 * 24,
					}, {
						name: "relativeLifetime",
						title: "Cache lifetime (relative)",
						description: "Global video information will be refreshed if it is older than a percentage of the video age",
						type: "integer",
						restrict: { from: 1, to: 1e5, },
						suffix: "%",
						default: 20,
					}, {
						name: "likesColor",
						title: "Like color",
						type: "color",
						restrict: { match: (/^([A-z]{3,}|#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?)$/), },
						default: "#00BB22",
					}, {
						name: "dislikesColor",
						title: "Dislike color",
						type: "color",
						restrict: { match: (/^([A-z]{3,}|#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?)$/), },
						default: "#CC0000",
					}, {
						name: "barHeight",
						title: "Rating bar height",
						type: "number",
						restrict: { from: 0, to: 5, },
						suffix: "display pixel",
						default: 2,
					},
				],
			}, {
				name: "animateThumbs",
				title: "Animate thumbnails",
				description: "Let thumbnails loop through video preview images when hovered",
				type: "bool",
				default: true,
			}, {
				name: "autoExpandLists",
				title: "Automatically expand lists",
				description: "Automatically click the \"Show/Load more\"-button when scrolling to the end of a list",
				type: "bool",
				default: true,
			}, {
				name: "comments",
				title: "Show comments",
				type: "bool",
				default: true,
			}, {
				name: "hideRecommended",
				title: "Hide \"Recommended\" videos",
				description: "Removes any videos that are \"<i>Recommended</i> for you\" from the list of <i>related</i> videos",
				type: "bool",
				default: true,
			}, {
				name: "player",
				title: "Player preferences",
				description: "",
				type: "label",
				default: true,
				expanded: false,
				children: [
					{
						name: "defaultQualities",
						title: "Playback Quality",
						description: "",
						type: "menulist",
						default: [ "hd1080", "hd720", ],
						maxLength: 10,
						options: [
							{ value: "hd2160",	label:   "2160p | UHD 4k" },
							{ value: "hd1440",	label:   "1440p | Quad HD" },
							{ value: "hd1080",	label:   "1080p | Full HD" },
							{ value: "hd720",	label: "   720p | HD ready" }, /* The three '\u2009' indent the <option>'s text to align the '|'s */
							{ value: "large",	label: "   480p | large" },
							{ value: "medium",	label: "   360p | medium" },
							{ value: "small",	label: "   240p | small" },
							{ value: "tiny",	label: "   144p | tiny" },
						],
					}, {
						name: "zoomFactor",
						title: "Video zoom levels",
						description: "Factor that each zooming will scale the video",
						type: "integer",
						suffix: "%",
						restrict: { from: -50, to: 100, },
						default: 10,
					}, {
						name: "annotations",
						title: "Display annotations",
						type: "bool",
						default: false,
					}, {
						name: "alwaysVolume",
						title: "Always display volume",
						description: "The volume bar won't disappear",
						type: "bool",
						default: true,
					}, {
						name: "randomAutoplay",
						title: "YouTube auto play",
						description: "Check to keep YouTubes build-in auto-play functionality enabled",
						type: "hidden", // "bool",
						default: false,
					}, {
						name: "onStart",
						title: "Video start setting",
						description: "When the video starts:",
						type: "menulist",
						default: "focused",
						options: [
							{ value: "", label: "keep playing (YouTube default)", },
							{ value: "pause", label: "pause playback but keep buffering", },
							{ value: "visible", label: "only pause if the tab is not visible", },
							{ value: "focused", label: "only pause if the tab is not focused", },
						],
						children: [
							{
								name: "stop",
								title: "Stop",
								description: "Stop the video instead of pausing. This prevents buffering",
								type: "bool",
								default: false,
							},
						],
					}, {
						name: "cinemaMode",
						title: "Use Cinema Mode",
						description: "Makes seek bar a bit wider",
						type: "bool",
						default: false,
					}, {
						name: "seamlessFullscreen",
						title: "Enable seamless full screen",
						description: "Hides the sidebar to display the video player across the entire browser window",
						type: "bool",
						default: true,
						expanded: false,
						children: [
							{
								name: "atStart",
								title: "Load in full screen mode",
								description: "Full screen mode is enabled by default",
								type: "bool",
								default: false,
							}, {
								name: "showOnMouseRight",
								title: "Right edge motion",
								description: "Enables full screen mode when cursor is moved close to the right edge of the window",
								type: "integer",
								suffix: "pixel",
								restrict: { from: 0, to: 100, },
								default: 0,
							}, {
								name: "showOnScrollTop",
								title: "Scroll to top",
								description: "Enables full screen mode when scrolling to the very top of the page",
								type: "bool",
								default: true,
							}, {
								name: "hideOnScrollDown",
								title: "Scroll down",
								description: "Disables full screen when scrolling downwards",
								type: "bool",
								default: true,
							},
						],
					}, {
						name: "bypassAge",
						title: "Bypass age restriction",
						description: "Tries to load age restricted videos without the need to sign in to YouTube",
						type: "bool",
						default: true,
					},
				],
			}, {
				name: "keys",
				title: "Keyboard shortcuts",
				description: "To change a shortcut, focus the textbox and press any combination of the modifiers Alt, Command, Control and Shift plus another key. Note that some combinations may be reserved by the browser itself.<br>All key names are those of the standard English keyboard",
				type: "label",
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
				children: [
					{
						name: "openRelatedModifier",
						title: "Open related Videos",
						description: "Choose the modifier key to press alongside any of the number keys (top row) to load the corresponding video from the related videos list",
						type: "menulist",
						default: [ "" ],
						options: [
							{ value: "<disabled>",   label: "[disabled]", },
							{ value: "",             label: "[none]", },
							{ value: "Alt+",         label: "Alt", },
							{ value: "Ctrl+",        label: "Ctrl", },
							{ value: "Shift+",       label: "Shift", },
						],
					}, keybordKey({
						name: "videoIncreaseQuality",
						title: "Increase video quality",
						description: "",
						default: [ "Ctrl+ArrowUp", "Shift+BracketRight", "Numpad8", ],
					}), keybordKey({
						name: "videoDecreaseQuality",
						title: "Decrease video quality",
						description: "",
						default: [ "Ctrl+ArrowDown", "Shift+Slash", "Numpad2", ],
					}), keybordKey({
						name: "videoIncreaseSpeed",
						title: "Increase video speed",
						description: "",
						default: [ "BracketRight", "Numpad6", ],
					}), keybordKey({
						name: "videoDecreaseSpeed",
						title: "Decrease video speed",
						description: "",
						default: [ "Slash", "Numpad4", ],
					}), keybordKey({
						name: "videoTogglePause",
						title: "Play/pause",
						description: "Toggles Play/Pause in the current tab. (For the global playlist play/pause see \"Keyboard shortcuts\" at the bottom of the \"chrome://extensions\" page)",
						default: [ "Space", ],
					}), keybordKey({
						name: "videoToggleFullscreen",
						title: "Full screen",
						description: "Toggle YouTubes default full screen mode on/off",
						default: [ "KeyF", ],
					}), keybordKey({
						name: "videoPromptPosiotion",
						title: "Seek video to",
						description: "Prompt for video position in hh:mm:SS.ss",
						default: [ "KeyT", ],
					}), keybordKey({
						name: "videoPromptVolume",
						title: "Set volume to",
						description: "Prompt for video volume in %",
						default: [ "KeyV", ],
					}), keybordKey({
						name: "playlistNext",
						title: "Local playlist next",
						description: "Play the next video in the YouTube playlist in the current tab. (For the global playlist Next command see \"Keyboard shortcuts\" at the bottom of the \"chrome://extensions\" page)",
						default: [ "KeyN", ],
					}), keybordKey({
						name: "playlistPrevious",
						title: "Local playlist previous",
						description: "Play the previous video in the YouTube playlist in the current tab. (For the global playlist Previous command see \"Keyboard shortcuts\" at the bottom of the \"chrome://extensions\" page)",
						default: [ "KeyP", ],
					}), keybordKey({
						name: "playlistToggleShuffle",
						title: "Toggle local playlist shuffle",
						description: "",
						default: [ "KeyS", ],
					}), keybordKey({
						name: "playlistToggleLoop",
						title: "Toggle local playlist loop",
						description: "",
						default: [ "KeyR", ],
					}), keybordKey({
						name: "playlistClear",
						title: "Clear local playlist",
						description: "",
						default: [ "KeyE", ],
					}), keybordKey({
						name: "videoStop",
						title: "Stop video",
						description: "Stop the YouTube player (stops buffering and discards all buffering progress)",
						default: [ "KeyQ", ],
					}), keybordKey({
						name: "videoToggleMute",
						title: "Mute video",
						description: "",
						default: [ "KeyM", ],
					}), keybordKey({
						name: "videoToggleInfoScreen",
						title: "Display/hide the \"Stats for nerds\"",
						description: "",
						default: [ "KeyI", ],
					}), keybordKey({
						name: "videoPushScreenshot",
						title: "Take screenshot",
						description: "Take a screenshot of the video at its current position in its native resolution and add it to the screenshot list in the sidebar",
						default: [ "KeyC", ],
					}), keybordKey({
						name: "videoPopScreenshot",
						title: "Remove screenshot",
						description: "Remove the topmost, oldest screenshot from the sidebar",
						default: [ "KeyX", "Delete", ],
					}), keybordKey({
						name: "videoSave",
						title: "Save video",
						description: "Tries to save the current video, which will only work if the browser doesn't support DASH-playback and YouTube uses the 360p/720p-.mp4-fallback",
						default: [ "Ctrl+KeyS", ],
					}), keybordKey({
						name: "videoDownloadCover",
						title: "Download video cover",
						description: "Save the \"maxresdefault\" preview image of the video",
						default: [ "Ctrl+Alt+KeyS", "Numpad5", ],
					}), keybordKey({
						name: "videoAutoZoom",
						title: "Auto video zoom",
						description: "Adjusts the video zoom so that black bars at the top and/or bottom are hidden. Useful to view 21:9 videos with black bars in full screen on 21:9 displays",
						default: [ "KeyZ", "KeyA", ],
					}),
				],
			},
		],
	}, {
		name: "storage",
		title: "Storage options",
		description: "",
		type: "label",
		default: true,
		expanded: false,
		children: [
			{
				name: "export",
				title: "Export all collected data",
				description: "Copies the all cache data and user data to clipboard (as JSON)",
				default: [ "all", "viewed only", ],
				type: "control",
			}, {
				name: "import",
				title: "Import data",
				description: "Imports JSON formatted data form clipboard into the cache data / user data storage. Overwrites conflicting data",
				default: "Import",
				type: "control",
			}, {
				name: "getSize",
				title: "Show data size",
				default: "Show size",
				type: "control",
			}, {
				name: "clear",
				title: "Clear all collected data",
				description: "Irrevocably deletes all cache data and user data, keeps the settings/options selected on this page",
				default: "Purge",
				type: "control",
			},
		],
	}, {
		name: "reset",
		title: "Reset Options",
		description: "Reset all options displayed on this page to their default values",
		default: "Reset",
		type: "control",
		expanded: false,
	},
]);

function keybordKey(arg) {
	return Object.assign({ }, {
		type: "keybordKey",
		restrict: "inherit",
		maxLength: 5,
		expanded: false,
	}, arg);
}

}); })();
