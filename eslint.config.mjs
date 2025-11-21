import { defineConfig } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import sortClassMembers from "eslint-plugin-sort-class-members";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"),
	
    plugins: {
        "@typescript-eslint": typescriptEslint,
		"sort-class-members": sortClassMembers,
    },

    languageOptions: {
        parser: tsParser,
    },

	files: ["src/**/*.ts"],
	
    rules: {
        "sort-class-members/sort-class-members": ["error", {
            order: [
				"[static-properties]",
				"[properties]",
				"[conventional-private-properties]",
                "constructor",
				"[factory-methods]",
				"[static-methods]",
				"[accessor-pairs]",
				"[getters]",
				"[setters]",
				"[conventional-private-methods]",
				"[everything-else]"
            ],
			groups: {
			"factory-methods": [
				{ type: "method", static: true, name: "/^(create|from)/", sort: "alphabetical" }
			],
			"orchestration-methods": [
				{ type: "method", accessibility: "public", name: "/^(?!get|is|has|can|set|add|remove).*/", sort: "alphabetical" }
			]
			},
            accessorPairPositioning: "getThenSet",
        }],
		
		"quotes": ["error", "single", { avoidEscape: true }],
		"indent": ["error", "tab"],
        "@typescript-eslint/explicit-member-accessibility": ["error", {
            accessibility: "explicit",
        }],

		"@typescript-eslint/typedef": ["error",{
			"variableDeclaration": false,
			"variableDeclarationIgnoreFunction": true,
			"memberVariableDeclaration": true,
			"parameter": true,
			"arrayDestructuring": true,
			"objectDestructuring": true
			}
		],

        "comma-dangle": ["error", {
            arrays: "always-multiline",
            objects: "always-multiline",
            imports: "always-multiline",
            exports: "always-multiline",
            functions: "always-multiline",
        }],

        "@typescript-eslint/no-unused-vars": ["warn", {
			argsIgnorePattern: "^_",
			caughtErrorsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
        }],
    },
}]);