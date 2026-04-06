/* eslint-env node */
module.exports = {
  root: true,
  env: { es6: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // projectless mode = faster + no TSConfig include headaches
    ecmaVersion: 2020,
    sourceType: "module",
  },
  ignorePatterns: ["lib/**", "generated/**", "**/*.d.ts"],
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended",
    "google",
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    // chill the noise
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "max-len": ["off"],
    "import/no-unresolved": "off",

    // TS relaxations
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
};
