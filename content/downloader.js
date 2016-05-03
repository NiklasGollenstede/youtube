'use strict'; define('content/downloader', [
	'web/downloader',
	'es6lib',
], function(
	code,
	{
		dom: { createElement, once, },
	}
) {

return function(main) {
	var div = createElement('div');
	div.setAttribute('onclick', '('+ code +')();');
	div.click();
};

});
