import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/generado/**",
      "**/dist/**",
      "**/.angular/**",
      "**/coverage/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["backend/src/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { project: "backend/tsconfig.json" } },
      "boundaries/include": ["backend/src/**/*"],
      "boundaries/elements": [
        { type: "motor", pattern: "backend/src/motor" },
        { type: "proveedores", pattern: "backend/src/proveedores" },
        { type: "generado", pattern: "backend/src/generado" },
      ],
      "boundaries/files": [
        { category: "rutas", pattern: "**/*.rutas.ts" },
        { category: "controlador", pattern: "**/*.controlador.ts" },
        { category: "servicio", pattern: "**/*.servicio.ts" },
        { category: "repositorio", pattern: "**/*.repositorio.ts" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              from: { file: { categories: { anyOf: ["rutas", "controlador"] } } },
              disallow: {
                to: [
                  { file: { categories: "repositorio" } },
                  { element: { type: "generado" } },
                  { element: { type: "proveedores" } },
                ],
              },
            },
            {
              from: { element: { type: "motor" } },
              disallow: {
                to: [
                  {
                    file: {
                      categories: { anyOf: ["rutas", "controlador", "servicio", "repositorio"] },
                    },
                  },
                  { element: { type: "generado" } },
                  { element: { type: "proveedores" } },
                ],
              },
            },
            {
              from: { element: { type: "proveedores" } },
              disallow: {
                to: [
                  {
                    file: {
                      categories: { anyOf: ["rutas", "controlador", "servicio", "repositorio"] },
                    },
                  },
                  { element: { type: "generado" } },
                ],
              },
            },
          ],
        },
      ],
    },
  },
  {
    files: ["backend/src/modulos/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.\\./(?!\\.\\.)[^/]+/.+",
              message:
                'Desde otro módulo solo se importa su index.ts (ej.: "../carteras"), no sus archivos internos.',
            },
          ],
        },
      ],
    },
  },
);
