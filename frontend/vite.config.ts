import {defineConfig} from "vitest/config";
import {loadEnv} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    const proxyTarget = env.PROXY_TARGET || "http://localhost:3100";

    return {
        plugins: [react()],

        test: {
            environment: "jsdom",
            globals: true,
        },

        server: {
            host: "localhost",
            port: 5173,
            strictPort: true,

            proxy: {
                "/api": {
                    target: proxyTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
