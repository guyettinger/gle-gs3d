import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import css from 'rollup-plugin-import-css';
import { base64 } from './util/import-base-64.js';

const packageJson = require('./package.json');

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                file: packageJson.main,
                format: 'cjs',
                sourcemap: true,
                interop: 'auto',
                name: 'gle-gs3d'
            },
            {
                file: packageJson.module,
                format: 'esm',
                sourcemap: true,
            },
        ],
        plugins: [
            peerDepsExternal(),
            resolve(),
            commonjs(),
            typescript({tsconfig: './tsconfig.json'}),
            css(),
            terser(),
            base64({
                include: '**/*.wasm',
                sourceMap: false
            })
        ],
        external: [],
    },
    {
        input: 'src/index.ts',
        output: [{file: 'dist/types.d.ts', format: 'esm'}],
        plugins: [dts.default()],
    },
];


// import { base64 } from "./util/import-base-64.js";
// import terser from '@rollup/plugin-terser';
//
// export default [
//     {
//         input: './src/index.js',
//         treeshake: false,
//         external: p => /^three/.test( p ),
//         output: [
//             {
//                 name: 'Gaussian Splat 3D',
//                 extend: true,
//                 format: 'umd',
//                 file: './build/gaussian-splat-3d.umd.cjs',
//                 sourcemap: true,
//                 globals: p => /^three/.test( p ) ? 'THREE' : null,
//             },
//             {
//                 name: 'Gaussian Splat 3D',
//                 extend: true,
//                 format: 'umd',
//                 file: './build/gaussian-splat-3d.umd.min.cjs',
//                 sourcemap: true,
//                 globals: p => /^three/.test( p ) ? 'THREE' : null,
//                 plugins: [terser()]
//             }
//         ],
//         plugins: [
//             base64({ include: "**/*.wasm" })
//         ]
//     },
//     {
//         input: './src/index.js',
//         treeshake: false,
//         external: p => /^three/.test( p ),
//         output: [
//             {
//                 name: 'Gaussian Splat 3D',
//                 format: 'esm',
//                 file: './build/gaussian-splat-3d.module.js',
//                 sourcemap: true,
//                 globals: p => /^three/.test( p ) ? 'THREE' : null,
//             },
//             {
//                 name: 'Gaussian Splat 3D',
//                 format: 'esm',
//                 file: './build/gaussian-splat-3d.module.min.js',
//                 sourcemap: true,
//                 globals: p => /^three/.test( p ) ? 'THREE' : null,
//                 plugins: [terser()]
//             }
//         ],
//         plugins: [
//             base64({
//                 include: "**/*.wasm",
//                 sourceMap: false
//             })
//         ]
//     }
// ];
