import { relative } from 'node:path';

const generated = ['src/sources/beatsaver/generated/', 'src/sources/scoresaber/generated/'];

function argumentsFor(files) {
  return files
    .filter((file) => {
      const path = relative(process.cwd(), file).replaceAll('\\', '/');
      return !generated.some((directory) => path.startsWith(directory));
    })
    .map((file) => JSON.stringify(file))
    .join(' ');
}

export default {
  '*.{css,js,json,jsonc,jsx,md,ts,tsx,yaml,yml}': (files) => {
    const args = argumentsFor(files);
    return args === '' ? [] : [`bunx oxfmt --write ${args}`];
  },
  '*.{js,jsx,ts,tsx}': (files) => {
    const args = argumentsFor(files);
    return args === '' ? [] : [`bunx oxlint --fix ${args}`];
  },
};
