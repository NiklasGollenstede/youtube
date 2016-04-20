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
				description: "Load video rating for every thumbnail",
				type: "bool",
				value: true,
				children: [
					{
						name: "totalLifetime",
						title: "Cache lifetime (total)",
						description: "Maximum absolute lifetime of cached global video information",
						type: "integer",
						unit: "ms",
						value: 7 * 24 * 60 * 60,
					}, {
						name: "relativeLifetime",
						title: "Cache lifetime (relative)",
						description: "Global video information will be refreshed if it is older than a percentage of the video age",
						type: "integer",
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
				description: "Automatically click the \"Display more\"-button when scrolling to the end of a list",
				type: "bool",
				value: true,
			}, {
				name: "directExternalLinks",
				title: "Direct external links",
				description: "Disable YouTubes link indirection for external links",
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
						type: "menulist",
						title: "Playback Quality",
						description: "",
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
						type: "menulist",
						title: "Video start setting",
						description: "When the video starts:",
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
						description: "Tries to load age restricted videos without signing in to YouTube",
						type: "bool",
						value: true,
					},
				],
			}, {
				name: "keys",
				title: "Keyboard shortcuts",
				description: "To change a shortcut, focus the textbox and press any combination of the modifiers Alt, Command, Control and Shift plus another key. Note that some combinations are reserved by Chrome",
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
						type: "menulist",
						title: "Related Videos",
						description: "Press this key(s) and any number from 1 to 9 to load the corresponding video from the related videos colom (same as on the videos endscreen, if counted colom first",
						value: [ "" ],
						options: [
							{ value: "\0",   label: "[disabled]", },
							{ value: "",     label: "[none]", },
							{ value: "Ctrl+", label: "Ctrl", },
							{ value: "Alt+",  label: "Alt", },
						],
					}, {
						name: "videoIncreaseQuality",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "Ctrl+ArrowUp", "Shift+BracketRight", "Numpad8", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoDecreaseQuality",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "Ctrl+ArrowDown", "Shift+Slash", "Numpad2", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoIncreaseSpeed",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "BracketRight", "Numpad6", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoDecreaseSpeed",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "Slash", "Numpad4", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoTogglePause",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "Space", "MediaPlayPause", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoToggleFullscreen",
						title: "Full screen",
						description: "Toggle video full screen",
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
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyN", "MediaTrackNext", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistPrevious",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyP", "MediaTrackPrevious", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistToggleShuffle",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyS", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistToggleLoop",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyR", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "playlistClear",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyE", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoStop",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyQ", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoToggleMute",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyM", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoToggleInfoScreen",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyI", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoPushScreenshot",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyC", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoPopScreenshot",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "KeyX", "Delete", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoSave",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "Ctrl+KeyS", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoDownloadCover",
						title: "",
						description: "",
						type: "keybordKey",
						value: [ "Ctrl+Alt+KeyS", "Numpad5", ],
						restrict: "inherit",
						maxLength: 5,
					}, {
						name: "videoAutoZoom",
						title: "",
						description: "",
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
		type: "hidden",
		children: [
			{
				name: "export",
				title: "Export all collected data",
				description: "copies data to clipboard in JSON format",
				label: "Export",
				type: "control",
			}, {
				name: "import",
				title: "Import data",
				description: "imports JSON formatted data form clipboard into the storage",
				label: "Import",
				type: "control",
			}, {
				name: "fromHistory",
				title: "Import history",
				description: "imports view counts and dates from your chronic",
				label: "Import",
				type: "control",
			}, {
				name: "useCache",
				title: "Use Cache",
				description: "externally loaded information (e.g. view counts) is cached per video",
				type: "bool",
				value: true,
			},
		],
	},
]);

});
