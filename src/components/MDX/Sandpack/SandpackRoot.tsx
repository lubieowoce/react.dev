/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 */

import {Children} from 'react';
import * as React from 'react';
import {
  SandpackProvider,
  SandpackState,
  UseSandpack,
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

  const sandboxIds = useClientServerSandboxIds();
  const clientSandpack = React.useRef<UseSandpack | null>(null);
  const serverSandpack = React.useRef<UseSandpack | null>(null);
  const sandpacks = React.useMemo(
    () => ({
      server: serverSandpack,
      client: clientSandpack,
    }),
    []
  );
  const [messageChannel] = React.useState(() => {
    const channel = new MessageChannel();
    return {
      server: channel.port1,
      client: channel.port2,
    };
  });

  const sendRequestGeneric = usePostMessageRequest();
  const sendIframeRequest = useIframeRequest();
  React.useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const {data} = event;
      if (!data || typeof data !== 'object') {
        return;
      }
      if ('__rsc_init' in data) {
        const body = data.__rsc_init as {sandboxId: string};
        const target = sandboxIds.reverse[body.sandboxId];
        console.log('SandpackRoot :: sandbox bootstrapped:', target);

        const {iframe} = getClientFromSandpackState(
          sandpacks[target].current!.sandpack
        );
        const channelPort = messageChannel[target];
        console.log('sending port...', target);
        void sendIframeRequest('RSC_CHANNEL_PORT', [channelPort], iframe);
      }
    };
    window.addEventListener('message', onMessage, false);
    return () => window.removeEventListener('message', onMessage, false);
  }, [
    sandboxIds.reverse,
    messageChannel,
    sandpacks,
    sendRequestGeneric,
    sendIframeRequest,
  ]);

  return (
    <div className="sandpack sandpack--playground w-full my-8" dir="ltr">
      <SandpackProvider
        files={{
          ...template,
          ...(rsc
            ? {
                ...Object.fromEntries(Object.entries(files)),
                ...rscClientLibFiles,
                ...createSandboxIdFile(sandboxIds.client),
              }
            : files),
        }}
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
          logLevel: SandpackLogLevel.None,
          // logLevel: SandpackLogLevel.Debug,
        }}>
        <CustomPreset providedFiles={Object.keys(files)} />
        <ReadSandpack sandpackRef={clientSandpack} />
        {/* {rsc && typeof window !== undefined && <RSCConnection />} */}
      </SandpackProvider>
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
            ...createSandboxIdFile(sandboxIds.server),
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
            logLevel: SandpackLogLevel.None,
            // logLevel: SandpackLogLevel.Debug,
          }}>
          <ReadSandpack sandpackRef={serverSandpack} />
          <CustomPreset providedFiles={Object.keys(files)} />
          {/* {rsc && typeof window !== undefined && <RSCConnection />} */}
        </SandpackProvider>
      )}
    </div>
  );
}

function useClientServerSandboxIds() {
  const idBase = 'sandbox-' + React.useId().replace(':', '-');
  return React.useMemo(() => {
    const client = idBase + '-' + 'client';
    const server = idBase + '-' + 'server';
    const reverse = {
      [client]: 'client' as const,
      [server]: 'server' as const,
    };
    return {client, server, reverse};
  }, [idBase]);
}

const ReadSandpack = React.memo(function ReadSandpack({
  sandpackRef,
}: {
  sandpackRef: React.MutableRefObject<UseSandpack | null>;
}) {
  const value = useSandpack();
  React.useEffect(() => {
    sandpackRef.current = value;
  });
  React.useEffect(() => {
    sandpackRef.current = null;
  }, [sandpackRef]);
  return null;
});

function createSandboxIdFile(id: string) {
  return {
    'src/__rsc__/sandbox-id.js': {
      hidden: true,
      code: `export default ${JSON.stringify(id)}`,
    },
  };
}

const PLACEHOLDER_ID_FILE = `throw new Error("'src/__rsc__/sandbox-id.js' was not replaced"); export {}`;

const rscServerLibFiles = {
  'src/__rsc__/sandbox-id.js': PLACEHOLDER_ID_FILE,
  'src/index.js': `
import './__rsc__/webpack.js';
import { initMessaging, createRequestListener } from './__rsc__/init-messaging.js';

import App from './App.js'
import * as RSDWServer from 'react-server-dom-webpack/server';

async function handleRenderRequest() {
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
    return { id: moduleName, chunks: [moduleName], name: exportName, async: true }
  }
});

let cleanupPrevious;
initMessaging((port) => {
  if (cleanupPrevious) {
    cleanupPrevious();
  }
  console.log('rsc-server :: attaching request listener to port', port);
  const requestListener = createRequestListener(
    (data) => {
      if (data) { return }
      return handleRenderRequest();
    },
    { 
      sendReply: (...args) => port.postMessage(...args),
      name: 'rsc-server :: RSC_CHANNEL_PORT',
      debug: true,
    }
  );
  port.addEventListener('message', requestListener);
  port.start();
  console.log('rsc-server :: listening');
  cleanupPrevious = () => {
    port.removeEventListener('message', requestListener);
  };
});



`,
  '/src/__rsc__/init-messaging.js': `
import sandboxId from './sandbox-id.js';

const replyOnWindow = (data, transfer) => {
  window.parent.postMessage(data, '*', transfer);
}

export function createRequestListener(
  handler,
  { sendReply = replyOnWindow, name = 'RSC frame', debug = false } = {}
) {
  return async (event) => {
    debug && console.log(name + ' got message', event);
    const { data } = event;
    if (!data || typeof data !== 'object') {
      return;
    }
    if (!data.__rsc_request) {
      return;
    }
    debug && console.log(name + ' got request', event.data.__rsc_request);

    const { requestId, data: requestData } = data.__rsc_request;

    try {
      const response = await handler(requestData, event);
      debug && console.log(name, 'responding...', { requestId });
      sendReply(
        { __rsc_response: { requestId, data: response } },
        (response && typeof response === 'object') ? [response] : undefined,
      );
    } catch (error) {
      sendReply(
        { __rsc_response: { requestId, error: error.message ?? \`$\{error}\` } },
      );
    }
  }
}

export function createRequestClient(idBase = "") {
  const idRef = { current: 0 };
  return (
    /** @type {any} */ data,
    /** @type {any[] | undefined} */ transfer,
    /** @type {{ postMessage; responseTarget: EventTarget; maxDuration?: number; }} */ options
  ) =>
    new Promise((resolve, reject) => {
      const requestId = idBase + idRef.current++;
      const { postMessage, responseTarget, maxDuration = 10_000 } = options;

      const timeout = setTimeout(() => {
        reject(
          new Error('Did not receive response within ' + (maxDuration / 1000) +'s')
        );
        cleanup();
      }, 10_000);

      const responseHandler = (/** @type {MessageEvent<unknown>} */ event) => {
        const { data } = event;
        if (
          !data ||
          typeof data !== "object" ||
          !("__rsc_response" in data) ||
          !data.__rsc_response
        ) {
          return;
        }
        /** @type {{requestId: string} & ({data: unknown} | {error: string})} */
        const response = data.__rsc_response;
        if (response.requestId !== requestId) {
          return;
        }
        if ("error" in response) {
          reject(new Error(response.error));
        } else if (!("data" in response)) {
          reject(new Error("No data or error in response"));
        } else {
          resolve(response.data);
        }

        cleanup();
        clearTimeout(timeout);
      };

      responseTarget.addEventListener(
        "message",
        /** @type {EventListener} */ (responseHandler),
        false
      );
      const cleanup = () =>
        responseTarget.removeEventListener(
          "message",
          /** @type {EventListener} */ (responseHandler),
          false
        );

      postMessage({ __rsc_request: { requestId: requestId, data } }, transfer);
    });
}


export function initMessaging(onPortReceived) {
  addMessageListenerWithCleanup(
    createRequestListener((data, event) => {
      if (data === 'RSC_CHANNEL_PORT') {
        const port = event.ports[0];
        onPortReceived(port);
      }
    }),
    '__rsc_channel_port'
  );

  window.parent.postMessage(
    { __rsc_init: { sandboxId } },
    '*',
  );
}


function addMessageListenerWithCleanup(listener, name) {
  if (window[name] && window[name] !== listener) {
    window.removeEventListener(
      "message",
      window[name],
      false,
    );
    window[name] = listener;
  }
  window.addEventListener("message", listener, false);
};

`,
  '/src/__rsc__/webpack.js': `

const moduleCache = new Map();

function trackThenableState(promise) {
  if (typeof promise.status === 'string') {
    return promise
  }
  promise.status = "pending";
  promise.then(
    (value) => {
      promise.status = "fulfilled";
      promise.value = value;
    },
    (error) => {
      promise.status = "rejected";
      promise.reason = error;
    }
  );
  return promise;
}

const getOrImport = (/** @type {string} */ id) => {
  // in sandpack's case, modules and chunks are one and the same.
  if (!moduleCache.has(id)) {
    const promise = trackThenableState(import(id));
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
    
    const promise = getOrImport(id);
    // this is important because we can't easily get $$async set on our references,
    // and our imports are always async.
    // luckily, we always preload the modules, so this should be fulfilled at this point.
    if (promise.status === "fulfilled") {
      return promise.value;
    }
    return promise;
  };
}

export {};
`,
};

const rscClientLibFiles = {
  ...rscServerLibFiles,
  'src/index.js': `
import './__rsc__/webpack.js';
import { initMessaging, createRequestClient } from './__rsc__/init-messaging.js';
import { use, useState, startTransition } from 'react';
import { createRoot } from 'react-dom/client';

import * as RSDWClient from 'react-server-dom-webpack/client';


function promiseWithResolvers() {
  let resolve, reject;
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { promise, resolve, reject }
}

let didResolve = false;
const initialPromiseCtrl = promiseWithResolvers();
const setElementPromise = (promise) => {
  if (!didResolve) {
    initialPromiseCtrl.resolve(promise);
    didResolve = true;
  } else {
    setCurrentPromise(promise)
  }
}

let setCurrentPromise;
function Root({ initialPromise }) {
  const [promise, _setCurrentPromise] = useState(initialPromise);
  setCurrentPromise = _setCurrentPromise;
  return use(promise);
}

const root = createRoot(document.getElementById('root'));
startTransition(() => {
  root.render(<Root initialPromise={initialPromiseCtrl.promise} />)
});


initMessaging((port) => {
  console.log('rsc-client :: got port');
  const sendRequest = createRequestClient();

  (async () => {
    try {
      console.log('rsc-client :: requesting...');
      const responseStream = await sendRequest(undefined, undefined, {
        postMessage: (...args) => { port.start(); port.postMessage(...args) },
        responseTarget: port,
      });
      console.log('rsc-client :: got response', responseStream);
      if (!(responseStream instanceof ReadableStream)) {
        throw new Error('Received response is not a ReadableStream');
      }

      const [s1, s2] = responseStream.tee();
      const elementPromise = RSDWClient.createFromReadableStream(s1);
      console.log('rsc-client :: element promise', elementPromise)
      setElementPromise(elementPromise);

      const decoder = new TextDecoder();
      for await (const chunk of s2) {
        console.log(decoder.decode(chunk))
      }

    } catch (error) {
      setElementPromise(Promise.reject(error));
    }
  })();
});

`,
};

const getClientFromSandpackState = (sandpackState: SandpackState) => {
  const clients = Object.values(sandpackState.clients);
  if (clients.length > 1) {
    throw new Error('Multiple sandpack clients');
  }
  return clients[0] ?? null;
};

function RSCConnection() {
  const {sandpack, listen} = useSandpack();
  // console.log('RSCConnection ::', sandpack.clients);
  const client = getClientFromSandpackState(sandpack);
  const sendRequest = useIframeRequest();
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
      sendRequest(undefined, [], client.iframe).then(async (_stream) => {
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
  const sendRequestImpl = usePostMessageRequest();
  return React.useCallback(
    (data: any, transfer: any[] | undefined, iframe: HTMLIFrameElement) => {
      return sendRequestImpl(data, transfer, {
        postMessage: (data, transfer = undefined) =>
          iframe.contentWindow!.postMessage(data, '*', transfer),
        responseTarget: window,
      });
    },
    [sendRequestImpl]
  );
}

function usePostMessageRequest() {
  const idBase = React.useId();
  const idRef = React.useRef(0);

  return React.useCallback(
    (
      data: any,
      transfer: any[] | undefined,
      options: {
        postMessage: (data: any, transfer?: any[] | undefined) => void;
        responseTarget: EventTarget;
        maxDuration?: number;
      }
    ) =>
      new Promise((resolve, reject) => {
        const requestId = idBase + idRef.current++;
        const {postMessage, responseTarget, maxDuration = 10_000} = options;

        const timeout = setTimeout(() => {
          reject(
            new Error(`Did not receive response within ${maxDuration / 1000}s`)
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

        responseTarget.addEventListener(
          'message',
          responseHandler as EventListener,
          false
        );
        const cleanup = () =>
          responseTarget.removeEventListener(
            'message',
            responseHandler as EventListener,
            false
          );

        postMessage({__rsc_request: {requestId: requestId, data}}, transfer);
      }),
    [idBase]
  );
}

export default SandpackRoot;
