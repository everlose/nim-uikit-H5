import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // dev/start 使用 '/', build 使用 './'
  const base = command === 'serve' ? '/' : './';

  return {
    base,
    envDir: process.env.VITE_STRICT_ENV_DIR,
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
