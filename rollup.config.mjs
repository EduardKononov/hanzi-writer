import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import pkg from './package.json' with { type: 'json' };
import license from 'rollup-plugin-license';

const extensions = ['.js', '.ts'];

export default [
  {
    input: 'src/HanziWriter.ts',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'auto',
      },
      {
        file: 'dist/hanzi-writer.min.js',
        format: 'iife',
        name: 'HanziWriter',
        sourcemap: true,
        plugins: [terser()],
        exports: 'default',
      },
      {
        file: 'dist/hanzi-writer.js',
        format: 'iife',
        name: 'HanziWriter',
        exports: 'default',
      },
      {
        file: pkg.module,
        format: 'es',
        sourcemap: true,
        exports: 'default',
      },
    ],
    plugins: [
      resolve({ extensions }),
      typescript({
        tsconfig: './tsconfig.json',
      }),
      babel({
        exclude: 'node_modules/**',
        extensions,
        babelHelpers: 'bundled',
      }),
      license({
        banner: `Hanzi Writer v<%= pkg.version %> | https://chanind.github.io/hanzi-writer`,
      }),
    ],
  },
];
