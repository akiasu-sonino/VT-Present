import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            react,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            ...react.configs.recommended.rules,
            ...react.configs['jsx-runtime'].rules,
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            'react/prop-types': 'off', // TypeScriptで型チェックするため
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', '*.config.js'],
    },
];

