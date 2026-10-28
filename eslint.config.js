import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importX from 'eslint-plugin-import-x';
import perfectionist from 'eslint-plugin-perfectionist';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', '*.tsbuildinfo'] },

  js.configs.recommended,
  tseslint.configs.recommended,

  // 纯 JS 的 bench 脚本跑在 node 里，需要 node 全局变量。
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    plugins: { 'import-x': importX, perfectionist },
    rules: {
      // 把内联的 `import { type A, b }` 拆成独立的 `import type { A }`，
      // 保证 type 导入永远不和值导入混在同一条语句里。
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: true },
      ],
      // 禁止 `import { a, type B }` 这种行内 type，统一提升成 `import type { B }`。
      'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],

      'perfectionist/sort-imports': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
          ignoreCase: true,
          // 组与组之间空一行，组内不空行。Prettier 会保留这些空行。
          newlinesBetween: 1,
          newlinesInside: 0,
          // 允许把 side-effect 导入移动到第一组；关掉它们就会原地不动。
          sortSideEffects: true,
          // 全局路径别名：@/ ~/ #  以及 tsconfig.json paths 里声明的别名。
          internalPattern: ['^@/.+', '^~/.+', '^#.+'],
          tsconfig: { rootDir: '.' },
          groups: [
            // ── 1. 所有 type 导入（永远排在最前，且不与值导入混合）──
            ['type-builtin', 'type-external'], // 第三方包（含 node: 内置模块）
            ['type-tsconfig-path', 'type-internal'], // @ / ~ / # 等全局别名
            'type-parent', // ../
            ['type-sibling', 'type-index'], // ./
            'type-import', // 兜底：任何没落进上面四组的 type 导入

            // ── 2. 值导入 ──
            ['side-effect', 'side-effect-style'], // 只有 import、不导入任何变量
            ['value-builtin', 'value-external'], // 第三方包（含 node: 内置模块）
            ['value-tsconfig-path', 'value-internal'], // @ / ~ / # 等全局别名
            'value-parent', // ../
            ['value-sibling', 'value-index'], // ./

            'ts-equals-import',
            'unknown',
          ],
        },
      ],
    },
  },

  // 必须放最后：关掉所有与 Prettier 排版冲突的规则。
  eslintConfigPrettier,
);
