/**
 * Root ESLint flat config (for running ESLint from the repo root).
 * Each Next.js app keeps its own .eslintrc.json, which `next lint` uses.
 */
module.exports = [
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/.turbo/**', 'archive/**', 'apps/hub-pc/bundle/**'],
  },
];
