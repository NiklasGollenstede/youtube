'use strict';

module.exports = {
	parser: 'babel-eslint',
	parserOptions: {
		ecmaVersion: 7,
		sourceType: 'script',
		ecmaFeatures: {
			impliedStrict: false,
		},
	},
	extends: 'eslint:recommended',
	env: {
		browser: true,
		es6: true,
	},
	globals: {
		console: false,
		define: false,
		require: false,
	},
	rules: unCC({
		noConsole: warn({ allow: [ 'error', 'warn', 'info', 'log', ], }),
		strict: error('function'),
		noUndefInit: error(),
		noUnusedVars: warn({ argsIgnorePattern: '^_|^(global|event)$', caughtErrorsIgnorePattern: '^_$', }),
		eqeqeq: error('allow-null'),
		noEmpty: error({ allowEmptyCatch: true, }),
		noEmptyPattern: off(),
		noExAssign: off(), // only relevant in IE < 8
		noTemplateCurlyInString: error(),
		noUnsafeNegation: error(),

		consistentReturn: error({ treatUndefinedAsUnspecified: true, }),
		curly: error(),
		dotLocation: error('property'),
		noCaller: error(),
		noCaseDeclarations: error(),
		noDivRegex: error(),
		noExtraLabel: warn(),
		noGlobalAssign: warn(),
		semi: error('always'),
		noImplicitGlobals: error(),
		noImpliedEval: error(),
		noInvalidThis: error(),
		noMultiStr: error(),
		noOctalEscape: error(),
		noOctal: error(),
		noProto: error(),
		noReturnAssign: error(),
		noReturnAwait: error(),
		noThrowLiteral: error(),
		noUnusedExpressions: error({ allowShortCircuit: true, allowTernary: true, }),
		noUnusedLabels: error(),
		preferPromiseRejectErrors: error(),
		wrapIife: error('inside'),

		noMixedSpacesAndTabs: error('smart-tabs'),

		preferArrowCallback: error({ allowNamedFunctions: true, }),
		preferConst: error({ destructuring: 'all', }),
		// preferDestructuring: error({ array: false, object: true, }),
		restSpreadSpacing: error('never'),
		commaDangle: error({ arrays: 'always', objects: 'always', imports: 'always', exports: 'always', functions: 'ignore', }),
		noVar: error(),
	}),
};

function off(...args) {
	return [ 'off', ...args, ];
}

function error(...args) {
	return [ 'error', ...args, ];
}

function warn(...args) {
	return [ 'warn', ...args, ];
}

function unCC(rules) {
	Object.keys(rules).forEach(key => {
		const name = key.replace(/(.)([A-Z])/g, (_, _1, _2) => _1 +'-'+ _2.toLowerCase());
		if (name !== key) {
			rules[name] = rules[key];
			delete rules[key];
		}
	});
	return rules;
}
