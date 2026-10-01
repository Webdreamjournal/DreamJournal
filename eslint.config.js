import globals from 'globals';

// Correctness-only rules: these catch runtime ReferenceErrors / TypeErrors that no test
// exercises (undefined identifiers, assignments to imports, duplicate keys, ...).
// Style rules are intentionally not enabled.
const correctnessRules = {
    'no-undef': 'error',
    'no-import-assign': 'error',
    'no-const-assign': 'error',
    'no-redeclare': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-dupe-else-if': 'error',
    'no-dupe-class-members': 'error',
    'no-func-assign': 'error',
    'no-self-assign': 'error',
    'no-unreachable': 'error',
    'no-unsafe-negation': 'error',
    'no-unsafe-finally': 'error',
    'no-sparse-arrays': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error'
};

export default [
    { ignores: ['node_modules/**'] },
    {
        files: ['*.js', 'src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.browser, Dropbox: 'readonly' }
        },
        rules: correctnessRules
    },
    {
        files: ['sw.js'],
        languageOptions: { globals: { ...globals.serviceworker } }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
        rules: { 'no-undef': 'off' }
    }
];
