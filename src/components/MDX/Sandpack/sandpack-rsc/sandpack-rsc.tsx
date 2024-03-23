import {SandpackFiles} from '@codesandbox/sandpack-react/unstyled';
import {useMemo} from 'react';
import REACT_APIS from './react-apis';

export function useSandpackRSCSetup({isRSC}: {isRSC: boolean}) {
  const code = useMemo(() => {
    if (!isRSC) {
      return undefined;
    }
    return hideFiles({
      ...RSC_SHARED_LIB_FILES,
      ...RSC_SERVER_LIB_FILES,
      ...RSC_CLIENT_LIB_FILES,
    });
  }, [isRSC]);

  return {
    code,
    dependencies: rscExtraDeps,
  };
}

function hideFiles(files: SandpackFiles): SandpackFiles {
  return Object.fromEntries(
    Object.entries(files).map(([name, code]) => [
      name,
      typeof code === 'string' ? {code, hidden: true} : {...code, hidden: true},
    ])
  );
}

function getSandboxCodeFileContents(fileNames: string[]) {
  return Object.fromEntries(
    fileNames.map((fileName) => {
      const fileContents = require(`./sandbox-code/${fileName}`) as string;
      if (typeof fileContents !== 'string') {
        throw new Error(
          `Expected sandbox code file ${require.resolve(
            `./sandbox-code/${fileName}`
          )} to be a string, got '${typeof fileContents}'. Is 'asset/source' configured correctly for '*.source.js' files?`
        );
      }
      return [fileName, fileContents];
    })
  );
}

const RSC_SHARED_LIB_FILES = stripReactRefresh(
  getSandboxCodeFileContents([
    'src/__rsc__/shared/async-global.source.js',
    'src/__rsc__/shared/channel.source.js',
    'src/__rsc__/shared/promise-with-resolvers.source.js',
  ])
);

// This is missing in Safari, and react-server-dom-webpack/server.browser indirectly uses it
// by doing `new ReadableStream({ type: "bytes", ... })`
const needsByteStreamControllerPolyfill =
  typeof window !== 'undefined' &&
  typeof (
    // @ts-expect-error old ts lib types
    window['ReadableByteStreamController']
  ) === 'undefined';

const rscExtraDeps = needsByteStreamControllerPolyfill
  ? {'web-streams-polyfill': '^4.0.0'}
  : undefined;

const registerServerReferenceSpec = {
  importSource: '/src/__rsc__/server/register-server-reference.source.js',
  name: 'registerServerReference',
};

const createServerReferenceSpec = {
  importSource: '/src/__rsc__/client/create-server-reference.source.js',
  name: 'createServerReference',
};

export const REACT_PRESET_OPTIONS = {
  type: 'server',
  fs: true,
  serverActions: {
    transformOptions: {
      encryption: null,
      runtime: {
        callServer: undefined,
        createServerReference: createServerReferenceSpec,
        registerServerReference: registerServerReferenceSpec,
      },
    },
  },
  apiUsage: {
    include: '^/src/(?!__rsc__/)',
    apis: REACT_APIS,
    syntax: {
      asyncComponent: {server: 'supported', client: undefined},
    },
  },
};

const RSC_SERVER_LIB_FILES = stripReactRefresh({
  // `react-server` in sandpack is hardcoded to look for this as the "server" entrypoint
  'src/index.server.js': `
${
  needsByteStreamControllerPolyfill
    ? `import 'web-streams-polyfill/polyfill';`
    : ''
}
import { initServer } from './__rsc__/server/server.source.js';
import App from './App.js'

const getApp = () => App;
initServer(getApp);

`,
  ...getSandboxCodeFileContents([
    'src/__rsc__/server/server.source.js',
    'src/__rsc__/server/register-server-reference.source.js',
  ]),
});

const RSC_CLIENT_LIB_FILES = stripReactRefresh({
  // `react-server` in sandpack is hardcoded to look for this as the "client" entrypoint
  'src/index.client.js': `
import { initClient } from './__rsc__/client/client.source.js';

initClient();
`,
  ...getSandboxCodeFileContents([
    'src/__rsc__/client/client.source.js',
    'src/__rsc__/client/call-server.source.js',
    'src/__rsc__/client/create-server-reference.source.js',
  ]),
});

/** FIXME: react-refresh is injecting its code into our 'asset/source' modules on the level of next's webpack.
 * We should either:
 * - disable it for those files somehow
 * - figure out how to configure 'asset/source' modules to skip all other loaders
 * - make sandpacks bundler support `import.meta`, which is the thing that's throwing
 */
function stripReactRefresh(
  files: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([fileName, code]) => [
      fileName,
      stripReactRefreshPostludeFromCode(code),
    ])
  );
}

function stripReactRefreshPostludeFromCode(code: string) {
  // FIXME: HACK HACK HACK HACK
  const postludeStart = code.indexOf(
    '// Wrapped in an IIFE to avoid polluting the global scope'
  );
  if (postludeStart === -1) {
    return code;
  }
  return code.slice(0, postludeStart);
}
