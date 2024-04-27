import {SandpackFiles, useSandpack} from '@codesandbox/sandpack-react/unstyled';
import React, {
  useMemo,
  type MutableRefObject,
  useCallback,
  useEffect,
} from 'react';
import {createContext} from 'react';
import {useDebounced} from '../useDebounced';

export type SandpackRSCContextValue = {
  sandboxId: string;
  type: 'client' | 'server';
  port: MessagePort;
  other: MessagePort;
  onFileChanged?: FileChangeListener;
  onActiveFileChanged?: (fileName: string) => void;
  recreateMessageChannel: () => ReturnType<typeof createMessageChannel>;
};

type FileChangeListener = (fileName: string, newContent: string) => void;

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

function createMessageChannel() {
  const channel = new MessageChannel();
  return {
    here: channel.port1,
    there: channel.port2,
  };
}

function useMessageChannel() {
  const [channel, setChannel] = React.useState(createMessageChannel);
  const recreate = useCallback(() => {
    const newChannel = createMessageChannel();
    setChannel(newChannel); // TODO: flushSync?
    return newChannel;
  }, []);
  return React.useMemo(() => ({channel, recreate}), [channel, recreate]);
}

function useMessageChannelBridge(from: MessagePort, to: MessagePort) {
  useEffect(() => {
    const listener = (event: MessageEvent<unknown>) => {
      const transferable = findTransferable(event.data) ?? [];
      // console.log('found transferable objects in data', {
      //   data: event.data,
      //   transferable,
      // });
      if (event.ports) {
        transferable.push(...event.ports);
      }
      to.postMessage(event.data, transferable);
    };
    from.addEventListener('message', listener);
    from.start();
    return () => from.removeEventListener('message', listener);
  }, [from, to]);
}

/** https://stackoverflow.com/a/78016566 */
export function findTransferable(root: unknown) {
  const transferable = new Set<Transferable>();
  const valuesToSearch = [root];
  const visited = new Set<unknown>();

  function checkForTransferable(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (ArrayBuffer.isView(value)) {
      transferable.add(value.buffer); // ArrayBuffer
    } else if (
      value instanceof ArrayBuffer ||
      value instanceof MessagePort ||
      value instanceof ReadableStream ||
      value instanceof WritableStream ||
      value instanceof TransformStream
    ) {
      transferable.add(value as Transferable);
    } else {
      valuesToSearch.push(value);
    }
  }

  while (valuesToSearch.length) {
    const val = valuesToSearch.pop();
    if (!val || typeof val !== 'object') {
      continue;
    }
    if (visited.has(val)) {
      continue;
    }
    visited.add(val);
    if (Array.isArray(val)) {
      for (const item of val) {
        checkForTransferable(item);
      }
    } else if (
      Symbol.iterator in val &&
      typeof val[Symbol.iterator] === 'function'
    ) {
      // something iterable
      for (const item of Array.from(val as Iterable<unknown>)) {
        checkForTransferable(item);
      }
    } else {
      // regular object
      for (const key in val) {
        checkForTransferable((val as any)[key]);
      }
    }
  }
  if (transferable.size) {
    return Array.from(transferable);
  }
  return;
}

export function useSandpackRSCSetup({
  isRsc,
  initialFiles,
  initialActiveFile,
}: {
  isRsc: boolean;
  initialFiles: SandpackFiles;
  initialActiveFile?: string;
}) {
  const sandboxIds = useClientServerSandboxIds();
  // TODO: this doesn't handle file updates when editing the docs...
  const [files, setFiles] = React.useState(initialFiles);
  const [activeFile, setActiveFile] = React.useState(initialActiveFile);

  const clientChannel = useMessageChannel();
  const serverChannel = useMessageChannel();

  useMessageChannelBridge(
    clientChannel.channel.here,
    serverChannel.channel.here
  );
  useMessageChannelBridge(
    serverChannel.channel.here,
    clientChannel.channel.here
  );

  // TODO: batch this, no reason to do this file by file
  const onFileChanged = useCallback((fileName: string, code: string) => {
    setFiles((files) => {
      const existing = files[fileName];
      if (typeof existing === 'string' || typeof existing === 'undefined') {
        if (existing !== code) {
          return {...files, [fileName]: code};
        }
      } else if (typeof existing === 'object') {
        if (existing.code !== code) {
          return {...files, [fileName]: {...existing, code}};
        }
      }
      return files;
    });
  }, []);

  const clientContext: SandpackRSCContextValue | null = useMemo(() => {
    if (!isRsc) {
      return null;
    }
    return {
      type: 'client' as const,
      sandboxId: sandboxIds.client,
      port: clientChannel.channel.there,
      other: serverChannel.channel.here,
      onFileChanged,
      onActiveFileChanged: setActiveFile,
      recreateMessageChannel: clientChannel.recreate,
    };
  }, [
    isRsc,
    sandboxIds.client,
    clientChannel.channel.there,
    clientChannel.recreate,
    serverChannel.channel.here,
    onFileChanged,
  ]);

  const serverContext: SandpackRSCContextValue | null = useMemo(() => {
    if (!isRsc) {
      return null;
    }
    return {
      type: 'server' as const,
      sandboxId: sandboxIds.server,
      port: serverChannel.channel.there,
      other: clientChannel.channel.here,
      onFileChanged: undefined,
      recreateMessageChannel: serverChannel.recreate,
    };
  }, [
    isRsc,
    sandboxIds.server,
    serverChannel.channel.there,
    serverChannel.recreate,
    clientChannel.channel.here,
  ]);

  const context:
    | Record<'client' | 'server', null>
    | Record<'client' | 'server', SandpackRSCContextValue> =
    React.useMemo(() => {
      if (!isRsc) return {client: null, server: null};
      return {
        client: clientContext!,
        server: serverContext!,
      };
    }, [isRsc, clientContext, serverContext]);

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

  return {
    context,
    code,
    files: isRsc ? files : initialFiles,
    activeFile: isRsc ? activeFile : initialActiveFile,
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

declare global {
  interface Window {
    PORT_ID?: number;
    TRANSFERRED_PORTS?: Map<MessagePort, string>;
  }
}

const transferPort = (port: MessagePort, prefix: string) => {
  if (!window.TRANSFERRED_PORTS || window.PORT_ID === undefined) {
    window.PORT_ID = 0;
    window.TRANSFERRED_PORTS = new Map<MessagePort, string>();
  }
  const TRANSFERRED_PORTS = window.TRANSFERRED_PORTS as Map<
    MessagePort,
    string
  >;
  const existing = TRANSFERRED_PORTS.get(port);
  if (existing !== undefined) {
    throw new Error(`MessagePort ${existing} has already been transferred.`);
  }
  const id = prefix + '-' + window.PORT_ID++;
  console.log(
    `MessagePort ${id} has not been transferred yet!`,
    TRANSFERRED_PORTS
  );
  TRANSFERRED_PORTS.set(port, id);
  return port;
};

export function useSandpackRSCFrameBootstrap({debug = false} = {}) {
  const sendIframeRequest = useIframeRequest();
  const {
    sandboxId,
    port: messagePort,
    other: otherMessagePort,
    type,
    onFileChanged,
    onActiveFileChanged,
    recreateMessageChannel,
  } = React.useContext(SandpackRSCContext) ?? {};

  const {
    sandpack: {files: fastFiles, activeFile},
  } = useSandpack();
  const files = useDebounced(fastFiles);

  // TODO: do we need to reset this?
  const [fileCache] = React.useState(
    () =>
      new Map<string, string>(
        Object.entries(files).map(([fileName, fileData]) => [
          fileName,
          fileData.code,
        ])
      )
  );

  useEffect(() => {
    if (!onFileChanged) return;
    for (const fileName in files) {
      const fileData = files[fileName];
      const cached = fileCache.get(fileName);
      if (cached !== fileData.code) {
        console.debug('sandpack file changed', fileName);
        fileCache.set(fileName, fileData.code);
        onFileChanged(fileName, fileData.code);
      }
    }
  }, [onFileChanged, files, fileCache]);

  useEffect(() => {
    onActiveFileChanged?.(activeFile);
  }, [onActiveFileChanged, activeFile]);

  type MessageListener = (event: MessageEvent<unknown>) => void;
  const listenerRef = React.useRef<MessageListener | null>(null);

  const instanceState = React.useRef<{
    instanceId: string;
    port: MessagePort;
    iframe: HTMLIFrameElement;
  } | null>(null);

  const onIframeChange = React.useCallback(
    (iframe: HTMLIFrameElement | null) => {
      debug &&
        console.log(`rsc-${type} :: onIframeChange`, {mounted: !!iframe});
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
            const body = data.__rsc_init as {
              sandboxId: string;
              instanceId: string;
            };
            if (body.sandboxId === sandboxId) {
              debug &&
                console.log(`rsc-${type} :: onMessage :: sandbox bootstrapped`);
              let messagePortToSend = messagePort!;
              let isInitial = false;
              if (!instanceState.current) {
                isInitial = true;
                instanceState.current = {
                  instanceId: body.instanceId,
                  port: messagePort!,
                  iframe,
                };
              } else if (instanceState.current.instanceId !== body.instanceId) {
                debug &&
                  console.log(
                    `rsc-${type} :: onMessage :: got a new instance of an existing sandbox`
                  );
                messagePort!.close();
                const newChannel = recreateMessageChannel!(); // TODO: should this be flushSync?
                messagePortToSend = newChannel.there;
                instanceState.current = {
                  instanceId: body.instanceId,
                  port: messagePortToSend,
                  iframe,
                };
              }

              debug &&
                console.log(`rsc-${type} :: onMessage :: sending port...`);
              void sendIframeRequest(
                'RSC_CHANNEL_PORT',
                [transferPort(messagePortToSend, type!)],
                iframe
              )
                .then(() => true)
                .catch((err) => {
                  console.error(
                    `rsc-${type} :: onMessage :: Failed to send port.`,
                    err
                  );
                  return false;
                })
                .then((ok) => {
                  if (type === 'server' && !isInitial && ok) {
                    otherMessagePort!.postMessage('RSC_SERVER_UPDATED');
                  }
                });
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
    [
      debug,
      type,
      sandboxId,
      messagePort,
      sendIframeRequest,
      recreateMessageChannel,
      otherMessagePort,
    ]
  );

  return onIframeChange;
}

function createSandboxIdFile(id: string) {
  return {
    'src/__rsc__/sandbox-id.source.js': {
      hidden: true,
      code: `export default ${JSON.stringify(id)}`,
    },
  };
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
    'src/__rsc__/sandbox-id.source.js',
    'src/__rsc__/init-messaging.source.js',
    'src/__rsc__/webpack.source.js',
  ])
);

const RSC_SERVER_LIB_FILES = stripReactRefresh({
  'src/index.js': `
import { initServer } from './__rsc__/server.source.js';
import App from './App.js';

let cleanup = initServer(App);

if (module.hot) {
  // console.debug('rsc-server :: running in hot-reload mode', module.hot);
  module.hot.dispose(() => {
    console.debug('rsc-server :: module.hot.dispose: src/index.js');
    cleanup();
  });
  module.hot.accept(['./App.js'], ([newAppModule]) => {
    console.debug('rsc-server :: accepting new App.js');
    const App = newAppModule.default;
    cleanup();
    cleanup = initServer(App);
    // TODO: trigger a refetch in the client?
  });
}
`,
  ...getSandboxCodeFileContents(['src/__rsc__/server.source.js']),
});

const RSC_CLIENT_LIB_FILES = stripReactRefresh({
  'src/index.js': `
import { initClient } from './__rsc__/client.source.js';

const cleanup = initClient();

if (module.hot) {
  // console.debug('rsc-client :: running in hot-reload mode', module.hot);
  module.hot.dispose(() => {
    console.debug('rsc-client :: module.hot.dispose: src/index.js');
    cleanup();
  });
}
`,
  ...getSandboxCodeFileContents(['src/__rsc__/client.source.js']),
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

function useIframeRequest() {
  const sendRequestImpl = usePostMessageRequest();
  return React.useCallback(
    async (
      data: any,
      transfer: any[] | undefined,
      iframe: HTMLIFrameElement
    ) => {
      if (!iframe.contentWindow) {
        await new Promise<any>((resolve, reject) => {
          iframe.addEventListener('load', resolve, {once: true});
          iframe.addEventListener('error', reject, {once: true});
        });
        if (!iframe.contentWindow) {
          throw new Error('Cannot access contentWindow on iframe');
        }
      }
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
      postMessage: (data: any, transfer?: Transferable[] | undefined) => void;
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

      try {
        postMessage({__rsc_request: {requestId: requestId, data}}, transfer);
      } catch (err) {
        reject(err);
        cleanup();
        clearTimeout(timeout);
      }
    });
}
