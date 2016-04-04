'use strict'; define('options/defaults', [
	'es6lib/format',
], function(
	{ RegExpX, }
) {

return [
	{
		name: "debug",
		type: "hidden",
		value: true,
	}, {
		name: "doNotUseContentStyle",
		type: "hidden",
		value: false,
	}, {
		name: "storage",
		title: "Storage options",
		description: "",
		type: "label",
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
				description: "imports JSON formated data form clipboard into the storage",
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
				children: [
					{
						name: "cacheLifetime",
						title: "Cache lifetime",
						description: "cached information expire after xxx ms (to get refreshed)",
						type: "integer",
						value: 604800000,
					},
				],
			},
		],
	}, {
		name: "content",
		title: "Page options",
		description: "",
		type: "label",
		children: [
			{
				name: "enforceHtml5",
				title: "Enforce HTML5 Video player",
				description: "Only necessary prior to Firefox 38. \nEnforce YouTube to serve videos in the HTML5 player by appending &html5=1 to all video urls",
				type: "bool",
				value: false,
			}, {
				name: "displayRatings",
				title: "Display video ratings",
				description: "Load video rating for every thumbnail",
				type: "bool",
				value: true,
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
						description: "factor (in %) that each zooming will scale th video",
						type: "integer",
						value: 10,
						restrict: { from: -50, to: 100, },
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
						title: "Random auto play",
						description: "uncheck to disable random auto-play",
						type: "hidden", // "bool",
						value: false,
					}, {
						name: "pauseOnStart",
						title: "Pause on start",
						description: "Pauses the video at the start but keeps buffering",
						type: "bool",
						value: true,
						children: [
							{
								name: "playOnNotHidden",
								title: "Start video if tab is visible",
								description: "Video will be paused unless it loads in the selected tab of a not minimized window",
								type: "bool",
								value: false,
							}, {
								name: "playOnFocus",
								title: "Start video if tab is actively focused",
								description: "Video will only play if it would revive keyboard input at the time it loads",
								type: "bool",
								value: true,
							}, {
								name: "preventBuffering",
								title: "Dont buffer",
								description: "Don't just pause the video but stop it from buffering",
								type: "bool",
								value: false,
							},
						],
					}, {
						name: "cinemaMode",
						title: "Use Cinema Mode",
						description: "makes seek bar a bit wider",
						type: "bool",
						value: false,
					}, {
						name: "seamlessFullscreen",
						title: "Enable seamless full screen",
						description: "the video player will fill the entire browser window",
						type: "bool",
						value: true,
						children: [
							{
								name: "atStart",
								title: "Load in full screen mode",
								description: "full screen enabled on initial load",
								type: "bool",
								value: false,
							}, {
								name: "showOnMouseRight",
								title: "Right edge motion",
								description: "enables full screen when cursor is moved within X pixels of the right edge of the window",
								type: "integer",
								restrict: { from: 0, to: 100, },
								value: 20,
							}, {
								name: "showOnScrollTop",
								title: "Scroll to top",
								description: "enables full screen when scrolling to the very top of the page",
								type: "bool",
								value: true,
							}, {
								name: "hideOnScrollDown",
								title: "Scroll down",
								description: "disables full screen when scrolling downwards",
								type: "bool",
								value: true,
							},
						],
					},
				],
			}, {
				name: "keys",
				title: "Use keyboard shortcuts",
				description: "Uncheck to disable all shortcuts",
				type: "bool",
				value: true,
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
					},
				],
			},
		],
	},
];

});
