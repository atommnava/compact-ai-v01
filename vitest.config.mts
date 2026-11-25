import { configDefaults, defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL(".", import.meta.url)),
        }
    },
    test: {
        environment: 'node',
        include: ["**/*.test.ts"],
        // .claude/** contiene worktrees de otras sesiones con copias antiguas
        // del código; no deben ejecutarse como tests de este proyecto.
        exclude: [...configDefaults.exclude, ".claude/**"],
    },
});
