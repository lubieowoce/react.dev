import {SandpackFiles} from '@codesandbox/sandpack-react/unstyled';
import React, {useMemo, type MutableRefObject} from 'react';
import {createContext} from 'react';

export type SandpackRSCContextValue = {
  sandboxId: string;
  type: 'client' | 'server';
  port: MessagePort;
};

export const SandpackRSCContext = createContext<SandpackRSCContextValue | null>(
  null
);

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

export function useSandpackRSCSetup(isRsc: boolean) {
  const sandboxIds = useClientServerSandboxIds();

  const [messageChannel] = React.useState(() => {
    const channel = new MessageChannel();
    return {
      server: channel.port1,
      client: channel.port2,
    };
  });

  const context = React.useMemo(() => {
    if (!isRsc) return {client: null, server: null};
    return {
      client: {
        type: 'client' as const,
        sandboxId: sandboxIds.client,
        port: messageChannel.client,
      },
      server: {
        type: 'server' as const,
        sandboxId: sandboxIds.server,
        port: messageChannel.server,
      },
    };
  }, [
    isRsc,
    messageChannel.client,
    messageChannel.server,
    sandboxIds.client,
    sandboxIds.server,
  ]);

  const code = useMemo(() => {
    if (!isRsc) {
      return {client: undefined, server: undefined};
    }
    return {
      client: hideFiles({
        ...RSC_SHARED_LIB_FILES,
        ...RSC_CLIENT_LIB_FILES,
        ...createSandboxIdFile(sandboxIds.client),
      }),
      server: hideFiles({
        ...RSC_SHARED_LIB_FILES,
        ...RSC_SERVER_LIB_FILES,
        ...createSandboxIdFile(sandboxIds.server),
      }),
    };
  }, [isRsc, sandboxIds.client, sandboxIds.server]);

  return {context, code};
}

function hideFiles(files: SandpackFiles): SandpackFiles {
  return Object.fromEntries(
    Object.entries(files).map(([name, code]) => [
      name,
      typeof code === 'string' ? {code, hidden: true} : {...code, hidden: true},
    ])
  );
}

export function useSandpackRSCFrameBootstrap() {
  const sendIframeRequest = useIframeRequest();
  const {
    sandboxId,
    port: messagePort,
    type,
  } = React.useContext(SandpackRSCContext) ?? {};

  type MessageListener = (event: MessageEvent<unknown>) => void;
  const listenerRef = React.useRef<MessageListener | null>(null);
  const onIframeChange = React.useCallback(
    (iframe: HTMLIFrameElement | null) => {
      if (!sandboxId) {
        return;
      }
      if (iframe) {
        const onMessage: MessageListener = (event) => {
          const {data} = event;
          if (!data || typeof data !== 'object') {
            return;
          }
          if ('__rsc_init' in data) {
            const body = data.__rsc_init as {sandboxId: string};
            if (body.sandboxId === sandboxId) {
              console.log('SandpackRoot :: sandbox bootstrapped:', type);

              console.log('sending port...', type);
              void sendIframeRequest('RSC_CHANNEL_PORT', [messagePort], iframe);
            }
          }
        };
        window.addEventListener('message', onMessage, false);
        listenerRef.current = onMessage;
      } else {
        const onMessage = listenerRef.current;
        if (onMessage) {
          window.removeEventListener('message', onMessage, false);
        }
      }
    },
    [sandboxId, type, sendIframeRequest, messagePort]
  );
  return onIframeChange;
}

const PLACEHOLDER_ID_FILE = `throw new Error("'src/__rsc__/sandbox-id.js' was not replaced"); export {}`;

function createSandboxIdFile(id: string) {
  return {
    'src/__rsc__/sandbox-id.js': {
      hidden: true,
      code: `export default ${JSON.stringify(id)}`,
    },
  };
}

const RSC_SHARED_LIB_FILES = {
  'src/__rsc__/sandbox-id.js': PLACEHOLDER_ID_FILE,
  '/src/__rsc__/init-messaging.js': `
import sandboxId from './sandbox-id.js';

const replyOnWindow = (data, transfer) => {
  window.parent.postMessage(data, '*', transfer);
}

// this should match createPostMessageRequestClient
export function createPostMessageRequestListener(
  handler,
  { sendReply = replyOnWindow, name = 'RSC frame', debug = false } = {}
) {
  return async (event) => {
    debug && console.debug(name + ' got message', event);
    const { data } = event;
    if (!data || typeof data !== 'object') {
      return;
    }
    if (!data.__rsc_request) {
      return;
    }
    debug && console.debug(name + ' got request', event.data.__rsc_request);

    const { requestId, data: requestData } = data.__rsc_request;

    try {
      const response = await handler(requestData, event);
      debug && console.debug(name, 'responding...', { requestId });
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

// this is a fork of createPostMessageRequestClient
export function createPostMessageRequestClient(idBase = "") {
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
    createPostMessageRequestListener((data, event) => {
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

const RSC_SERVER_LIB_FILES = {
  'src/index.js': `
import './__rsc__/webpack.js';
import { initMessaging, createPostMessageRequestListener } from './__rsc__/init-messaging.js';

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

const debug = false;

let cleanupPrevious;
initMessaging((port) => {
  if (cleanupPrevious) {
    cleanupPrevious();
  }
  debug && console.debug('rsc-server :: attaching request listener to port', port);

  const requestListener = createPostMessageRequestListener(
    (data) => {
      if (data) { return }
      return handleRenderRequest();
    },
    { 
      sendReply: (...args) => port.postMessage(...args),
      name: 'rsc-server :: RSC_CHANNEL_PORT',
      debug,
    }
  );
  port.addEventListener('message', requestListener);
  port.start();
  debug && console.debug('rsc-server :: listening');
  cleanupPrevious = () => {
    port.removeEventListener('message', requestListener);
  };
});

`,
};

const RSC_CLIENT_LIB_FILES = {
  'src/index.js': `
import './__rsc__/webpack.js';
import { initMessaging, createPostMessageRequestClient } from './__rsc__/init-messaging.js';
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

const debug = false;

initMessaging((port) => {
  debug && console.debug('rsc-client :: got port');
  const sendRequest = createPostMessageRequestClient();

  (async () => {
    try {
      debug && console.debug('rsc-client :: requesting...');
      const responseStream = await sendRequest(undefined, undefined, {
        postMessage: (...args) => { port.start(); port.postMessage(...args) },
        responseTarget: port,
      });
      debug && console.debug('rsc-client :: got response', responseStream);
      if (!(responseStream instanceof ReadableStream)) {
        throw new Error('Received response is not a ReadableStream');
      }

      const [s1, s2] = responseStream.tee();
      const elementPromise = RSDWClient.createFromReadableStream(s1);
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

  return React.useMemo(
    () => createPostMessageRequestClient(idBase, idRef),
    [idBase, idRef]
  );
}

function createPostMessageRequestClient(
  idBase: string,
  idRef: MutableRefObject<number>
) {
  return (
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
    });
}
