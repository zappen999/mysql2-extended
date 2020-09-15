module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	],
	rules: {
		'max-len': [
			'error',
			{
				code: 80,
				ignoreUrls: true,
				ignoreTemplateLiterals: true,
			},
		],
		'comma-dangle': ['error', 'always-multiline'],
	},
	overrides: [
		{
			files: ['src/**/*.test.ts'],
			rules: {
				'@typescript-eslint/no-non-null-assertion': 'off',
			},
		},
	],
};
