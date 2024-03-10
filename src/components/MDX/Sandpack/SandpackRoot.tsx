/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 */

import {Children} from 'react';
import * as React from 'react';
import {
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react/unstyled';
import {SandpackLogLevel} from '@codesandbox/sandpack-client';
import {CustomPreset} from './CustomPreset';
import {createFileMap} from './createFileMap';
import {CustomTheme} from './Themes';
import {template} from './template';

type SandpackProps = {
  children: React.ReactNode;
  autorun?: boolean;
  rsc?: boolean;
};

const sandboxStyle = `
* {
  box-sizing: border-box;
}

body {
  font-family: sans-serif;
  margin: 20px;
  padding: 0;
}

h1 {
  margin-top: 0;
  font-size: 22px;
}

h2 {
  margin-top: 0;
  font-size: 20px;
}

h3 {
  margin-top: 0;
  font-size: 18px;
}

h4 {
  margin-top: 0;
  font-size: 16px;
}

h5 {
  margin-top: 0;
  font-size: 14px;
}

h6 {
  margin-top: 0;
  font-size: 12px;
}

code {
  font-size: 1.2em;
}

ul {
  padding-inline-start: 20px;
}
`.trim();

function SandpackRoot(props: SandpackProps) {
  let {children, autorun = true, rsc = false} = props;
  const codeSnippets = Children.toArray(children) as React.ReactElement[];
  const files = createFileMap(codeSnippets);

  files['/src/styles.css'] = {
    code: [sandboxStyle, files['/src/styles.css']?.code ?? ''].join('\n\n'),
    hidden: !files['/src/styles.css']?.visible,
  };

  return (
    <div className="sandpack sandpack--playground w-full my-8" dir="ltr">
      {/* TODO: unflag when stuff works! */}
      {!rsc && (
        <SandpackProvider
          files={{...template, ...files}}
          theme={CustomTheme}
          customSetup={{
            environment: 'react' as any,
          }}
          options={{
            bundlerTimeOut: Infinity,
            autorun,
            initMode: 'user-visible',
            initModeObserverOptions: {rootMargin: '1400px 0px'},
            bundlerURL: 'http://localhost:1234/', // github.com:lubieowoce/sandpack-bundler.git 3cd6682
            // bundlerURL: 'https://786946de.sandpack-bundler-4bw.pages.dev',
            // logLevel: SandpackLogLevel.None,
            logLevel: SandpackLogLevel.Debug,
          }}>
          <CustomPreset providedFiles={Object.keys(files)} />
          {/* {rsc && typeof window !== undefined && <RSCConnection />} */}
        </SandpackProvider>
      )}
      {rsc && (
        <SandpackProvider
          files={{
            ...template,
            ...files,
            ...Object.fromEntries(
              Object.entries(rscServerLibFiles).map(([name, code]) => [
                name,
                {code, hidden: true},
              ])
            ),
          }}
          theme={CustomTheme}
          customSetup={{
            environment: 'react-server' as any,
          }}
          options={{
            bundlerTimeOut: Infinity,
            autorun,
            initMode: 'user-visible',
            initModeObserverOptions: {rootMargin: '1400px 0px'},
            bundlerURL: 'http://localhost:1234/', // github.com:lubieowoce/sandpack-bundler.git 3cd6682
            // bundlerURL: 'https://786946de.sandpack-bundler-4bw.pages.dev',
            // logLevel: SandpackLogLevel.None,
            logLevel: SandpackLogLevel.Debug,
          }}>
          <CustomPreset providedFiles={Object.keys(files)} />
          {rsc && typeof window !== undefined && <RSCConnection />}
        </SandpackProvider>
      )}
    </div>
  );
}

const rscServerLibFiles = {
  'src/index.js': `
import './__rsc__/webpack.js';
import App from './App.js'
import * as RSDWServer from 'react-server-dom-webpack/server';

async function handleRequest() {
  const stream = await RSDWServer.renderToReadableStream(
    <App />,
    moduleMap,
    { onError: console.error }
  );
  return stream;
};

const moduleMap = new Proxy({}, {
  get(_, key) {
    const [moduleUrl, exportName] = key.split('#');
    const prefix = 'file://';
    const moduleName = moduleUrl.startsWith(prefix) ? moduleUrl.slice(prefix.length) : moduleUrl
    // console.log('moduleMap', { moduleName, exportName });
    return { id: moduleName, chunks: [moduleName], name: exportName }
  }
});

const listener = async (event) => {
  // console.log('RSC frame got message', event)
  const { data } = event;
  if (!data.__rsc_request) {
    return
  }

  const { requestId } = data.__rsc_request;

  try {
    const stream = await handleRequest();
    // console.log('RSC frame', 'responding...', { requestId })
    window.parent.postMessage(
      { __rsc_response: { requestId, data: stream } },
      '*',
      [stream]
    );
  } catch (error) {
    window.parent.postMessage(
      { __rsc_response: { requestId, error: error.message ?? \`$\{error}\` } },
      '*',
    );
  }
}

// nastily handle hot reload
if (window.__RSC_LISTENER && window.__RSC_LISTENER !== listener) {
  window.removeEventListener(
    "message",
    window.__RSC_LISTENER,
    false,
  );
  window.__RSC_LISTENER = listener;
}

window.addEventListener(
  "message",
  listener,
  false,
);
`,
  '/src/__rsc__/webpack.js': `
  // console.log("installing __webpack_require__...");

const moduleCache = new Map();

const getOrImport = (/** @type {string} */ id) => {
  // in sandpack's case, modules and chunks are one and the same.
  if (!moduleCache.has(id)) {
    const promise = import(id);
    moduleCache.set(id, promise);
  }
  return moduleCache.get(id);
}

if (typeof globalThis["__webpack_require__"] !== "function") {
  globalThis["__webpack_chunk_load__"] = (/** @type {string} */ id) => {
    // console.log('__webpack_chunk_load__', id)

    // in sandpack's case, there is no concept of chunks.
    // but it's probably best that we have a preload-adjacent thing,
    // so in the client reference, we set the chunk to the same filename as the module,
    // and just import() it.
    // unlike __webpack_chunk_load__, this also evaluates the module,
    // but we don't really mind here.
    return getOrImport(id);
  }

  /** @type {Map<string, Promise<Record<string, unknown>>>} */
  globalThis["__webpack_require__"] = (/** @type {string} */ id) => {
    // console.log('__webpack_require__', id);

    return getOrImport(id);
  };
}

export {};
`,
};

function RSCConnection() {
  const {sandpack, listen} = useSandpack();
  // console.log('RSCConnection ::', sandpack.clients);
  const clients = Object.values(sandpack.clients);
  if (clients.length > 1) {
    throw new Error('Multiple sandpack clients');
  }
  const sendRequest = useIframeRequest();
  const client = clients[0] ?? null;
  const onCompilationDone = React.useCallback(
    (success: boolean) => {
      if (!success) {
        return;
      }
      if (!client) {
        console.error(
          'RSCConnection :: Compilation succeeded, but client is not available'
        );
        return;
      }
      console.assert(
        client.status === 'done',
        'Received "done" message but client is not done',
        client
      );
      console.log('RSCConnection :: Sending request to iframe');
      sendRequest(client.iframe).then(async (_stream) => {
        const stream = _stream as ReadableStream<Uint8Array>;
        const decoder = new TextDecoder();

        // @ts-expect-error missing type definitions for ReadableStream being iterable?
        const iterableStream = stream as AsyncIterable<Uint8Array>;

        for await (const chunk of iterableStream) {
          console.log(decoder.decode(chunk));
        }
      });
    },
    [client, sendRequest]
  );

  React.useEffect(() => {
    return listen((message) => {
      if (message.type === 'done') {
        onCompilationDone(!message.compilatonError);
      }
    });
  }, [onCompilationDone, listen]);

  if (!client) {
    return null;
  }

  return null;
}

function useIframeRequest() {
  const idBase = React.useId();
  const idRef = React.useRef(0);

  const sendRequest = React.useCallback(
    (iframe: HTMLIFrameElement) =>
      new Promise((resolve, reject) => {
        const requestId = idBase + idRef.current++;
        const MAX_DURATION = 10_000;

        const timeout = setTimeout(() => {
          reject(
            new Error(`Did not receive response within ${MAX_DURATION / 1000}s`)
          );
          cleanup();
        }, 10_000);

        const responseHandler = (event: MessageEvent<unknown>) => {
          const {data} = event;
          if (
            !data ||
            typeof data !== 'object' ||
            !('__rsc_response' in data) ||
            !data.__rsc_response
          ) {
            return;
          }
          const response = data.__rsc_response as {requestId: string} & (
            | {data: unknown}
            | {error: string}
          );
          if (response.requestId !== requestId) {
            return;
          }
          if ('error' in response) {
            reject(new Error(response.error));
          } else if (!('data' in response)) {
            reject(new Error('No data or error in response'));
          } else {
            resolve(response.data);
          }

          cleanup();
          clearTimeout(timeout);
        };

        window.addEventListener('message', responseHandler, false);
        const cleanup = () =>
          window.removeEventListener('message', responseHandler, false);

        iframe.contentWindow!.postMessage(
          {__rsc_request: {requestId: requestId}},
          '*'
        );
      }),
    [idBase]
  );

  return sendRequest;
}

export default SandpackRoot;
