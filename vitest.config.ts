import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    // .claude/ tiene worktrees con copias del repo (y su node_modules): no correr sus tests
    exclude: ["**/node_modules/**", ".next/**", ".claude/**"],
  },
})
