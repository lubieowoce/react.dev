// @ts-check

const execa = require('execa');
const allApis = {react: {}, 'react-dom': {}};

/** @returns {string[]} */
const getPackageExports = (package, type) => {
  return JSON.parse(
    execa.sync(
      'node',
      ['-e', `console.log(JSON.stringify(Object.keys(require("${package}"))))`],
      {
        env:
          type === 'server'
            ? {NODE_OPTIONS: '--conditions="react-server"'}
            : undefined,
      }
    ).stdout
  ).filter((key) => !key.startsWith('__'));
};
for (const package of ['react', 'react-dom']) {
  const serverApis = getPackageExports(package, 'server');

  const client = getPackageExports(package, 'client');

  const apis = {};
  serverApis.forEach((name) => {
    apis[name] ??= {};
    apis[name].server = 'supported';
  });
  client.forEach((name) => {
    apis[name] ??= {};
    apis[name].client = 'supported';
  });
  allApis[package] = apis;
}
// console.log(allApis);

allApis.react.Profiler.server = 'noop';
allApis.react.StrictMode.server = 'noop';

allApis.react.startTransition.server = 'noop';
allApis.react.useMemo.server = 'noop';
allApis.react.createRef.server = 'noop';
allApis.react.useContext.server = undefined;

allApis.react.lazy.server = 'noop';
allApis.react.memo.server = 'noop';

allApis.react.cache.client = undefined;

for (const name of ['useActionState', 'experimental_useActionState']) {
  allApis.react[name] ??= {};
  allApis.react[name].client = 'supported';
  allApis.react[name].server = undefined;
}

for (const name of ['useFormState', 'experimental_useFormState']) {
  allApis['react-dom'][name] ??= {};
  allApis['react-dom'][name].client = 'supported';
  allApis['react-dom'][name].server = undefined;
}

for (const name of ['useFormStatus', 'experimental_useFormStatus']) {
  allApis['react-dom'][name] ??= {};
  allApis['react-dom'][name].client = 'supported';
  allApis['react-dom'][name].server = undefined;
}

for (const name of [
  'createPortal',
  'createRoot',
  'experimental_useFormStatus',
  'findDOMNode',
  'flushSync',
  'hydrate',
  'hydrateRoot',
  'render',
  'unmountComponentAtNode',
  'unstable_batchedUpdates',
  'unstable_renderSubtreeIntoContainer',
  'unstable_runWithPriority',
]) {
  allApis['react-dom'][name].server = undefined;
}
console.log(allApis);
