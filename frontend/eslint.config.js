import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import {defineConfig, globalIgnores} from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores(["dist"]),
    {
        files: ["src/**/*.{ts,tsx}"],
        extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
        languageOptions: {globals: globals.browser},
    },
    {
        // The Cloudflare Worker and its test are plain JavaScript modules.
        files: ["*.js", "functions/**/*.js"],
        extends: [js.configs.recommended],
        languageOptions: {globals: {...globals.serviceworker, ...globals.node}},
    },
]);
