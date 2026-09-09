import { defineConfig } from 'vite';

// GitHub Pages のリポジトリ名に依存しないよう相対パスで出力する。
// （https://<user>.github.io/<repo>/ 配下でもそのまま動く）
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
    host: true,
  },
});
