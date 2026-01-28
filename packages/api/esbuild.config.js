// packages/api/esbuild.config.js
const esbuild = require('esbuild')
const path = require('path')

const root = path.resolve(__dirname, '../..')

esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/server.js',
  sourcemap: true,
  minify: false,
  format: 'cjs',

  alias: {
    '@shared': path.join(root, 'packages/shared/src'),
  },

  external: [
    'bcrypt',
    'sharp',
    'ffmpeg-static',
  ],

  logLevel: 'info',
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
