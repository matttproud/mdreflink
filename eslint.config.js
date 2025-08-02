import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import google from 'eslint-config-google';

export default tseslint.config(
    js.configs.recommended,
    google,
    ...tseslint.configs.recommended,
    jsdoc.configs['flat/recommended-typescript'],
    {
      ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
    },
    {
      plugins: {
        jsdoc,
      },
      rules: {
        'require-jsdoc': 'off',
        'valid-jsdoc': 'off',
        'jsdoc/check-syntax': 'error',
        'jsdoc/check-tag-names': 'error',
      },
    },
);
