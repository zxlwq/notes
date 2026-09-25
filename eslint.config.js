import js from '@eslint/js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tailwindcss from 'eslint-plugin-tailwindcss'
import globals from 'globals'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const tailwindConfigPath = path.join(projectRoot, 'tailwind.config.cjs')

const tsUnusedVarsRule = [
  'warn',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    ignoreRestSiblings: true,
    args: 'after-used',
  },
]

const reactRules = {
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
}

const jsStrictRules = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'warn',
  curly: ['warn', 'multi-line'],
  'no-throw-literal': 'error',
  'prefer-promise-reject-errors': 'error',
  'no-duplicate-imports': 'error',
  'no-implicit-coercion': 'warn',
  'no-return-await': 'warn',
  'require-await': 'warn',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'no-debugger': 'warn',
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-extra-boolean-cast': 'warn',
  'no-unexpected-multiline': 'error',
}

const edgeGlobals = {
  Request: 'readonly',
  Response: 'readonly',
  fetch: 'readonly',
  Headers: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  ReadableStream: 'readonly',
  WritableStream: 'readonly',
  TransformStream: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  crypto: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
}

export default [
  js.configs.recommended,

  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'build/**',
      '.vite/**',
      '*.config.js',
      '*.config.ts',
      'postcss.js',
      'tailwind.config.cjs',
      'vite.config.ts',
      'eslint.config.js',
      'prettier.config.js',
      'stylelint.config.js',
    ],
  },

  ...tailwindcss.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}'],
    settings: {
      tailwindcss: {
        config: tailwindConfigPath,
        callees: ['clsx'],
      },
    },
    rules: {
      ...config.rules,
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/enforces-shorthand': 'warn',
      'tailwindcss/enforces-negative-arbitrary-values': 'warn',
      'tailwindcss/no-unnecessary-arbitrary-value': 'warn',
      'tailwindcss/no-custom-classname': 'off',
    },
  })),

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactRules,
      '@typescript-eslint/no-unused-vars': tsUnusedVarsRule,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-undef': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-extra-boolean-cast': 'warn',
      'no-empty-pattern': 'warn',
      'no-unexpected-multiline': 'error',
    },
  },

  {
    files: ['functions/types.ts', 'src/vite.ts', 'src/types/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },

  {
    files: ['src/lib/utils.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          args: 'none',
        },
      ],
      'no-unused-vars': 'off',
    },
  },

  {
    files: ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.ts', 'src/contexts/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactRules,
      '@typescript-eslint/no-unused-vars': tsUnusedVarsRule,
      'no-unused-vars': 'off',
    },
  },

  {
    files: ['functions/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...edgeGlobals,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  {
    files: ['server/**/*.js', 'api/**/*.js', 'shared/**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...jsStrictRules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-useless-escape': 'warn',
    },
  },

  {
    files: ['edge-functions/**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: edgeGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...jsStrictRules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  {
    files: ['workers/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: edgeGlobals,
    },
    rules: {
      ...jsStrictRules,
      'no-undef': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
    },
  },

  eslintConfigPrettier,
]
