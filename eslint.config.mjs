import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Librerías de infraestructura prohibidas en el núcleo (domain/application).
const INFRA_LIBS = ['@prisma/client', 'zod', 'jose', '@node-rs/*', 'node:*'];

const layer = (from, forbidden) => ({
  files: [`apps/api/src/**/${from}/**/*.ts`],
  ignores: ['**/*.test.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...forbidden.map((f) => ({
            group: [`**/${f}/**`, `**/${f}`],
            message: `Arquitectura hexagonal: la capa "${from}" no puede importar de "${f}".`,
          })),
          {
            group: INFRA_LIBS,
            message: `Arquitectura hexagonal: la capa "${from}" no puede usar librerías de infraestructura; define un puerto.`,
          },
        ],
      },
    ],
  },
});

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'apps/app/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  // Reglas de dependencia entre capas: domain <- application <- infrastructure/interfaces
  layer('domain', ['application', 'infrastructure', 'interfaces']),
  layer('application', ['infrastructure', 'interfaces']),
  prettier,
);
