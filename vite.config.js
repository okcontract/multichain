import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  esbuild: {
    minify: true
  },
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    target: "ES2020",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "cells"
    },
    rollupOptions: {
      plugins: []
    }
  }
});
