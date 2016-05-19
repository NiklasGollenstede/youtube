'use strict'; define('content/options', [
	'web-ext-utils/options',
	'web-ext-utils/chrome',
], function(
	Options,
	{ storage: Storage, }
) {

return function(main) {
	return new Options({
		defaults: [{name:"displayRatings",default:true,children:[{name:"totalLifetime",default:604800},{name:"relativeLifetime",default:20},{name:"likesColor",default:"#00BB22"},{name:"dislikesColor",default:"#CC0000"},{name:"barHeight",default:2}]},{name:"animateThumbs",default:true},{name:"autoExpandLists",default:true},{name:"player",default:[],children:[{name:"defaultQualities",default:["hd1080","hd720","auto"]},{name:"zoomFactor",default:10},{name:"annotations",default:false},{name:"alwaysVolume",default:true},{name:"randomAutoplay",default:false},{name:"onStart",default:"focused"},{name:"cinemaMode",default:false},{name:"seamlessFullscreen",default:true,children:[{name:"atStart",default:false},{name:"showOnMouseRight",default:0},{name:"showOnScrollTop",default:true},{name:"hideOnScrollDown",default:true}]},{name:"bypassAge",default:true}]},{name:"keys",default:[],children:[{name:"openRelatedModifier",default:""},{name:"videoIncreaseQuality",default:["Ctrl+ArrowUp","Shift+BracketRight","Numpad8"]},{name:"videoDecreaseQuality",default:["Ctrl+ArrowDown","Shift+Slash","Numpad2"]},{name:"videoIncreaseSpeed",default:["BracketRight","Numpad6"]},{name:"videoDecreaseSpeed",default:["Slash","Numpad4"]},{name:"videoTogglePause",default:"Space"},{name:"videoToggleFullscreen",default:"KeyF"},{name:"videoPromptPosiotion",default:"KeyT"},{name:"videoPromptVolume",default:"KeyV"},{name:"playlistNext",default:"KeyN"},{name:"playlistPrevious",default:"KeyP"},{name:"playlistToggleShuffle",default:"KeyS"},{name:"playlistToggleLoop",default:"KeyR"},{name:"playlistClear",default:"KeyE"},{name:"videoStop",default:"KeyQ"},{name:"videoToggleMute",default:"KeyM"},{name:"videoToggleInfoScreen",default:"KeyI"},{name:"videoPushScreenshot",default:"KeyC"},{name:"videoPopScreenshot",default:["KeyX","Delete"]},{name:"videoSave",default:"Ctrl+KeyS"},{name:"videoDownloadCover",default:["Ctrl+Alt+KeyS","Numpad5"]},{name:"videoAutoZoom",default:["KeyZ","KeyA"]}]}],
		prefix: 'options.content',
		storage: Storage.sync,
		addChangeListener: listener => {
			const onChanged = changes => Object.keys(changes).forEach(key => key.startsWith('options.content') && listener(key, changes[key].newValue));
			Storage.onChanged.addListener(onChanged);
			main.once(Symbol.for('destroyed'), () => Storage.onChanged.removeListener(onChanged));
		},
	});
};

});

/* // used to create the reduced 'defaults' option
JSON.stringify((function Clone(options) {
	const clones = [ ];
	options.forEach(option => {
		const clone = { name: option.name, default: option.defaults, };
		option.children && option.children.length && (clone.children = Clone(option.children));
		clones.push(clone);
	});
	return clones;
})(options.content.children)).replace(/({|,)"(\w+)":/g, '$1$2:').replace(/\[([^,]+?)\]/g, '$1');
*/