'use strict'; define('options/utils', function() {

function simplify(branches) {
	const result = { };

	branches.forEach(({ children, value, name, }) => {
		if (children && (value || value === undefined)) {
			result[name] = simplify(children);
		} else {
			result[name] = value;
		}
	});

	return result;
}

return { simplify, };

});
