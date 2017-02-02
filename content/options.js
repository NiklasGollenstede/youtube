(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Storage, },
	'node_modules/web-ext-utils/options/': Options,
}) => {

// eslint-disable-next-line comma-dangle
const defaults = [{name:"displayRatings",default:true,children:[{name:"totalLifetime",default:168},{name:"relativeLifetime",default:20},{name:"likesColor",default:"#00BB22"},{name:"dislikesColor",default:"#CC0000"},{name:"barHeight",default:2}]},{name:"animateThumbs",default:true},{name:"comments",default:true},{name:"autoExpandLists",default:true},{name:"hideRecommended",default:true},{name:"player",default:[],children:[{name:"defaultQualities",default:["hd1080","hd720","auto"]},{name:"zoomFactor",default:10},{name:"annotations",default:false},{name:"alwaysVolume",default:true},{name:"randomAutoplay",default:false},{name:"onStart",default:"focused",children:[{name:"stop",default:false}]},{name:"cinemaMode",default:false},{name:"seamlessFullscreen",default:true,children:[{name:"atStart",default:false},{name:"showOnMouseRight",default:0},{name:"showOnScrollTop",default:true},{name:"hideOnScrollDown",default:true}]},{name:"bypassAge",default:true}]},{name:"keys",default:[],children:[{name:"openRelatedModifier",default:""},{name:"videoIncreaseQuality",default:["Ctrl+ArrowUp","Shift+BracketRight","Numpad8"]},{name:"videoDecreaseQuality",default:["Ctrl+ArrowDown","Shift+Slash","Numpad2"]},{name:"videoIncreaseSpeed",default:["BracketRight","Numpad6"]},{name:"videoDecreaseSpeed",default:["Slash","Numpad4"]},{name:"videoTogglePause",default:"Space"},{name:"videoToggleFullscreen",default:"KeyF"},{name:"videoPromptPosiotion",default:"KeyT"},{name:"videoPromptVolume",default:"KeyV"},{name:"playlistNext",default:"KeyN"},{name:"playlistPrevious",default:"KeyP"},{name:"playlistToggleShuffle",default:"KeyS"},{name:"playlistToggleLoop",default:"KeyR"},{name:"playlistClear",default:"KeyE"},{name:"videoStop",default:"KeyQ"},{name:"videoToggleMute",default:"KeyM"},{name:"videoToggleInfoScreen",default:"KeyI"},{name:"videoPushScreenshot",default:"KeyC"},{name:"videoPopScreenshot",default:["KeyX","Delete"]},{name:"videoSave",default:"Ctrl+KeyS"},{name:"videoDownloadCover",default:["Ctrl+Alt+KeyS","Numpad5"]},{name:"videoAutoZoom",default:["KeyZ","KeyA"]}]}];

const listerners = new WeakMap;

return new Options({
	model: defaults,
	prefix: 'options.content',
	storage: Storage.sync || Storage.local,
	addChangeListener(listener) {
		const onChanged = changes => Object.keys(changes).forEach(key => key.startsWith('options') && listener(key, changes[key].newValue));
		listerners.set(listener, onChanged);
		Storage.onChanged.addListener(onChanged);
	},
	removeChangeListener(listener) {
		const onChanged = listerners.get(listener);
		listerners.delete(listener);
		Storage.onChanged.removeListener(onChanged);
	},
});

}); })(this);

/* // used to create the reduced 'defaults' option
JSON.stringify((function Clone(options) {
	const clones = [ ];
	options.forEach(option => {
		const clone = { name: option.name, default: option.defaults, };
		option.children && option.children.length && (clone.children = Clone(option.children));
		clones.push(clone);
	});
	return clones;
})(options.children.content.children)).replace(/({|,)"([A-Za-z]\w*)":/g, '$1$2:').replace(/\[([^,]+?)\]/g, '$1');
*/
