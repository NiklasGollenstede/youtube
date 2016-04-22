'use strict'; define('options/defaults', [
	'es6lib/format',
], function(
	{ RegExpX, }
) {

return Object.freeze([
	{
		name: "debug",
		type: "hidden",
		value: true,
	}, {
		name: "content",
		title: "Page options",
		description: "",
		type: "label",
		children: [
			{
				name: "displayRatings",
				title: "Display video ratings",
				description: "Displays a video rating bar for every thumbnail and shows the view count and video age when the cursor hovers over the image. This needs to load a snippet of information from YOuTube servers for every thumbnail and caches these to reduce the network load",
				type: "bool",
				value: true,
				children: [
					{
						name: "totalLifetime",
						title: "Cache lifetime (total)",
						description: "Maximum absolute lifetime of cached global video information. Set to -1 to disable caching",
						type: "integer",
						restrict: { from: -1, to: 365 * 24 * 60 * 60, },
						unit: "ms",
						value: 7 * 24 * 60 * 60,
					}, {
						name: "relativeLifetime",
						title: "Cache lifetime (relative)",
						description: "Global video information will be refreshed if it is older than a percentage of the video age",
						type: "integer",
						restrict: { from: 1, to: 1e5, },
						unit: "%",
						value: 20,
					},
				],
			}, {
				name: "animateThumbs",
				title: "Animate thumbnails",
				description: "Let thumbnails loop through video preview images when hovered",
				type: "bool",
				value: true,
			}, {
				name: "autoExpandLists",
				title: "Automatically expand lists",
				description: "Automatically click the \"Show/Load more\"-button when scrolling to the end of a list",
				type: "bool",
				value: true,
			}, {
				name: "player",
				title: "Player preferences",
				description: "",
				type: "label",
				children: [
					{
						name: "defaultQualities",
						title: "Playback Quality",
						description: "",
						type: "menulist",
						value: [ "hd1080", "hd720", "auto" ],
						maxLength: 10,
						options: [
							{ value: "auto",	label: "auto" },
							{ value: "hd2160",	label: "2160p | UHD 4k" },
							{ value: "hd1440",	label: "1440p | Quad HD" },
							{ value: "hd1080",	label: "1080p | Full HD" },
							{ value: "hd720",	label: "720p  | HD ready" },
							{ value: "large",	label: "480p  | large" },
							{ value: "medium",	label: "360p  | medium" },
							{ value: "small",	label: "240p  | small" },
							{ value: "tiny",	label: "144p  | tiny" },
						],
					}, {
						name: "zoomFactor",
						title: "Video zoom levels",
						description: "Factor that each zooming will scale the video",
						type: "integer",
						unit: "%",
						restrict: { from: -50, to: 100, },
						value: 10,
					}, {
						name: "annotations",
						title: "Display annotations",
						type: "bool",
						value: false,
					}, {
						name: "alwaysVolume",
						title: "Always display volume",
						description: "The volume bar won't disappear",
						type: "bool",
						value: true,
					}, {
						name: "randomAutoplay",
						title: "YouTube auto play",
						description: "Check to keep YouTubes build-in auto-play functionality enabled",
						type: "hidden", // "bool",
						value: false,
					}, {
						name: "onStart",
						title: "Video start setting",
						description: "When the video starts:",
						type: "menulist",
						value: "focused",
						options: [
							{ value: "play", label: "keep playing (YouTube default)", },
							{ value: "stop", label: "stop playback without buffering", },
							{ value: "pause", label: "pause playback but keep buffering", },
							{ value: "visible", label: "only pause if the tab is not visible", },
							{ value: "focused", label: "only pause if the tab is not focused", },
						],
					}, {
						name: "cinemaMode",
						title: "Use Cinema Mode",
						description: "Makes seek bar a bit wider",
						type: "bool",
						value: false,
					}, {
						name: "seamlessFullscreen",
						title: "Enable seamless full screen",
						description: "Hides the sidebar to display the video player across the entire browser window",
						type: "bool",
						value: true,
						children: [
							{
								name: "atStart",
								title: "Load in full screen mode",
								description: "Full screen mode is enabled by default",
								type: "bool",
								value: false,
							}, {
								name: "showOnMouseRight",
								title: "Right edge motion",
								description: "Enables full screen mode when cursor is moved close to the right edge of the window",
								type: "integer",
								unit: "pixel",
								restrict: { from: 0, to: 100, },
								value: 0,
							}, {
								name: "showOnScrollTop",
								title: "Scroll to top",
								description: "Enables full screen mode when scrolling to the very top of the page",
								type: "bool",
								value: true,
							}, {
								name: "hideOnScrollDown",
								title: "Scroll down",
								description: "Disables full screen when scrolling downwards",
								type: "bool",
								value: true,
							},
						],
					}, {
						name: "bypassAge",
						title: "Bypass age restriction",
						description: "Tries to load age restricted videos without the need to sign in to YouTube",
						type: "bool",
						value: true,
					},
				],
			}, {
				name: "keys",
				title: "Keyboard shortcuts",
				description: "To change a shortcut, focus the textbox and press any combination of the modifiers Alt, Command, Control and Shift plus another key. Note that some combinations are reserved by Chrome itself",
				type: "label",
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
				) $`), message: 'Please enter a valid key combination', },
				children: [
					{
						name: "openRelatedModifier",
						title: "Open related Videos",
						description: "Choose the modifier key to press alongside any of the number keys (top row) to load the corresponding video from the related videos list",
						type: "menulist",
						value: [ "" ],
						options: [
							{ value: "\0",   label: "[disabled]", },
							{ value: "",     label: "[none]", },
							{ value: "Alt+",  label: "Alt", },
							{ value: "Ctrl+", label: "Ctrl", },
							{ value: "Shift+",  label: "Shift", },
						],
					}, {
						name: "videoIncreaseQuality",
						title: "Increase video quality",
						description: "",
						type: "keybordKey",
						value: [ "Ctrl+ArrowUp", "Shift+BracketRight", "Numpad8", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoDecreaseQuality",
						title: "Decrease video quality",
						description: "",
						type: "keybordKey",
						value: [ "Ctrl+ArrowDown", "Shift+Slash", "Numpad2", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoIncreaseSpeed",
						title: "Increase video speed",
						description: "",
						type: "keybordKey",
						value: [ "BracketRight", "Numpad6", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoDecreaseSpeed",
						title: "Decrease video speed",
						description: "",
						type: "keybordKey",
						value: [ "Slash", "Numpad4", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoTogglePause",
						title: "Play/pause",
						description: "Toggles Play/Pause in the current tab. (For the global playlist play/pause see \"Keyboard shortcuts\" at the bottom of the \"chrome://extensions\" page)",
						type: "keybordKey",
						value: [ "Space", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoToggleFullscreen",
						title: "Full screen",
						description: "Toggle YouTubes default full screen mode on/off",
						type: "keybordKey",
						value: [ "KeyF", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoPromptPosiotion",
						title: "Seek video to",
						description: "Prompt for video position in hh:mm:SS.ss",
						type: "keybordKey",
						value: [ "KeyT", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoPromptVolume",
						title: "Set volume to",
						description: "Prompt for video volume in %",
						type: "keybordKey",
						value: [ "KeyV", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistNext",
						title: "Local playlist next",
						description: "Play the next video in the YouTube playlist in the current tab. (For the global playlist Next command see \"Keyboard shortcuts\" at the bottom of the \"chrome://extensions\" page)",
						type: "keybordKey",
						value: [ "KeyN", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistPrevious",
						title: "Local playlist previous",
						description: "Play the previous video in the YouTube playlist in the current tab. (For the global playlist Previous command see \"Keyboard shortcuts\" at the bottom of the \"chrome://extensions\" page)",
						type: "keybordKey",
						value: [ "KeyP", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistToggleShuffle",
						title: "Toggle local playlist shuffle",
						description: "",
						type: "keybordKey",
						value: [ "KeyS", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistToggleLoop",
						title: "Toggle local playlist loop",
						description: "",
						type: "keybordKey",
						value: [ "KeyR", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistClear",
						title: "Clear local playlist",
						description: "",
						type: "keybordKey",
						value: [ "KeyE", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoStop",
						title: "Stop video",
						description: "Stop the YouTube player (stops buffering and discards all buffering progress)",
						type: "keybordKey",
						value: [ "KeyQ", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoToggleMute",
						title: "Mute video",
						description: "",
						type: "keybordKey",
						value: [ "KeyM", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoToggleInfoScreen",
						title: "Display/hide the \"Stats for nerds\"",
						description: "",
						type: "keybordKey",
						value: [ "KeyI", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoPushScreenshot",
						title: "Take screenshot",
						description: "Take a screenshot of the video at its current position in its native resolution and add it to the screenshot list in the sidebar",
						type: "keybordKey",
						value: [ "KeyC", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoPopScreenshot",
						title: "Remove screenshot",
						description: "Remove the topmost, oldest screenshot from the sidebar",
						type: "keybordKey",
						value: [ "KeyX", "Delete", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoSave",
						title: "Save video",
						description: "Tries to save the current video, which will only work if the browser doesn't support DASH-playback and YouTube uses the 360p/720p-.mp4-fallback",
						type: "keybordKey",
						value: [ "Ctrl+KeyS", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoDownloadCover",
						title: "Download video cover",
						description: "Save the \"maxresdefault\" preview image of the video",
						type: "keybordKey",
						value: [ "Ctrl+Alt+KeyS", "Numpad5", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoAutoZoom",
						title: "Auto video zoom",
						description: "Adjusts the video zoom so that black bars at the top and/or bottom are hidden. Useful to view 21:9 videos with black bars in full screen on 21:9 displays",
						type: "keybordKey",
						value: [ "KeyZ", "KeyA", ],
						restrict: "inherit",
						maxLength: 5,
					},
				],
			},
		],
	}, {
		name: "storage",
		title: "Storage options",
		description: "",
		type: "label",
		children: [
			{
				name: "export",
				title: "Export all collected data",
				description: "Copies the all cache data and user data to clipboard (as JSON)",
				label: "Export",
				type: "control",
			}, {
				name: "import",
				title: "Import data",
				description: "Imports JSON formatted data form clipboard into the cache data / user data storage",
				label: "Import",
				type: "control",
			}, {
				name: "clear",
				title: "Clear all collected data",
				description: "Irrevocably deletes all cache data and user data, keeps the settings/options selected on this page",
				label: "Purge",
				type: "control",
			},
		],
	},
]);

});
