import {SandpackFiles} from '@codesandbox/sandpack-react/unstyled';
import {useMemo} from 'react';

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
    'src/__rsc__/webpack.source.js',
    'src/__rsc__/async-global.source.js',
    'src/__rsc__/channel.source.js',
    'src/__rsc__/promise-with-resolvers.source.js',
  ])
);

const RSC_SERVER_LIB_FILES = stripReactRefresh({
  'src/index.server.js': `
import { initServer } from './__rsc__/server.source.js';
import App from './App.js'

const getApp = () => App;
initServer(getApp);

`,
  ...getSandboxCodeFileContents([
    'src/__rsc__/server.source.js',
    'src/__rsc__/webpack.server.source.js',
  ]),
});

const RSC_CLIENT_LIB_FILES = stripReactRefresh({
  'src/index.client.js': `
import { initClient } from './__rsc__/client.source.js';

initClient();
`,
  ...getSandboxCodeFileContents([
    'src/__rsc__/client.source.js',
    'src/__rsc__/webpack.client.source.js',
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
