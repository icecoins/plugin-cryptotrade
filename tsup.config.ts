import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  outDir: 'dist',
  tsconfig: './tsconfig.build.json', // Use build-specific tsconfig
  sourcemap: true,
  clean: true,
  format: ['esm'], // Ensure you're targeting CommonJS
  splitting: false,
  shims: false,
  dts: true, // Skip DTS generation to avoid external import issues // Ensure you're targeting CommonJS
  external: [
    'dotenv', // Externalize dotenv to prevent bundling
    'fs', // Externalize fs to use Node.js built-in module
    'path', // Externalize other built-ins if necessary
    'https',
    'http',
    '@elizaos/core',
    'zod',
    'util'
  ],
});
