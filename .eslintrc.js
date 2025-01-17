module.exports = {
  env: {
    node: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
  },
  overrides: [{ files: ['*.mjs'], parserOptions: { sourceType: 'module' } }],
  rules: {},
};
