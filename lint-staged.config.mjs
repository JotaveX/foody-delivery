// Frontend tools are resolved from frontend/node_modules and run with frontend/ as cwd,
// so oxlint and Prettier pick up the frontend's own config files.
const inFrontend = (cmd) => (files) => `sh scripts/frontend-exec.sh ${cmd} ${files.map((f) => `"${f}"`).join(' ')}`;

export default {
  'frontend/**/*.{js,jsx,ts,tsx}': [inFrontend('oxlint --fix'), inFrontend('prettier --write')],
  'frontend/**/*.{json,css,scss,md,html}': [inFrontend('prettier --write --ignore-unknown')],
};
