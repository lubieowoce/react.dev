import {SandpackFiles, useSandpack} from '@codesandbox/sandpack-react/unstyled';
import React, {
  useMemo,
  type MutableRefObject,
  useCallback,
  useEffect,
  startTransition,
} from 'react';
import {createContext} from 'react';
import {useDebounced} from '../useDebounced';

export type SandpackRSCContextValue = {
  sandboxId: string;
  type: 'client' | 'server';
  port: MessagePort;
  onFileChanged?: FileChangeListener;
  onFileListenerReady?: (listener: FileChangeListener | null) => void;
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
    server: channel.port1,
    client: channel.port2,
  };
}

export function useSandpackRSCSetup(
  isRsc: boolean,
  initialFiles: SandpackFiles
) {
  const sandboxIds = useClientServerSandboxIds();
  // TODO: this doesn't handle file updates when editing the docs...
  const [files, setFiles] = React.useState(initialFiles);

  const [messageChannel, setMessageChannel] =
    React.useState(createMessageChannel);
  const recreateMessageChannel = useCallback(() => {
    const newMessageChannel = createMessageChannel();
    setMessageChannel(newMessageChannel);
    return newMessageChannel;
  }, []);

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

  const context:
    | Record<'client' | 'server', null>
    | Record<'client' | 'server', SandpackRSCContextValue> =
    React.useMemo(() => {
      if (!isRsc) return {client: null, server: null};
      return {
        client: {
          type: 'client' as const,
          sandboxId: sandboxIds.client,
          port: messageChannel.client,
          onFileChanged,
          onFileListenerReady: undefined,
          recreateMessageChannel,
        },
        server: {
          type: 'server' as const,
          sandboxId: sandboxIds.server,
          port: messageChannel.server,
          onFileChanged: undefined,
          // onFileListenerReady,
          onFileListenerReady: undefined,
          recreateMessageChannel,
        },
      };
    }, [
      isRsc,
      messageChannel.client,
      messageChannel.server,
      sandboxIds.client,
      sandboxIds.server,
      onFileChanged,
      // onFileListenerReady,
      recreateMessageChannel,
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

  return {context, code, files: isRsc ? files : initialFiles};
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
    onFileListenerReady,
    onFileChanged,
    recreateMessageChannel,
  } = React.useContext(SandpackRSCContext) ?? {};

  const {
    sandpack: {updateFile, files: fastFiles},
  } = useSandpack();
  const files = useDebounced(fastFiles);

  useEffect(() => {
    if (!onFileListenerReady) return;
    onFileListenerReady((fileName, code) => updateFile(fileName, code, true));
    return () => onFileListenerReady(null);
  }, [onFileListenerReady, updateFile]);

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
    // console.debug('sandpack files changed', files);
    startTransition(() => {
      for (const fileName in files) {
        const fileData = files[fileName];
        const cached = fileCache.get(fileName);
        if (cached !== fileData.code) {
          console.debug('sandpack file changed', fileName);
          fileCache.set(fileName, fileData.code);
          onFileChanged(fileName, fileData.code);
        }
      }
    });
  }, [onFileChanged, files, fileCache]);

  type MessageListener = (event: MessageEvent<unknown>) => void;
  const listenerRef = React.useRef<MessageListener | null>(null);

  const instanceState = React.useRef<{
    instanceId: string;
    port: MessagePort;
    iframe: HTMLIFrameElement;
  } | null>(null);

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
            const body = data.__rsc_init as {
              sandboxId: string;
              instanceId: string;
            };
            if (body.sandboxId === sandboxId) {
              let messagePortToSend = messagePort!;
              console.log('sandpack-rsc :: sandbox bootstrapped:', type);
              if (!instanceState.current) {
                instanceState.current = {
                  instanceId: body.instanceId,
                  port: messagePort!,
                  iframe,
                };
              } else if (instanceState.current.instanceId !== body.instanceId) {
                // TODO: this is convoluted... how do we make sure the other side gets it too?
                console.log(
                  'sandpack-rsc :: got a new instance of an existing sandbox'
                );
                messagePort!.close();
                const newChannel = recreateMessageChannel!();
                messagePortToSend = newChannel[type!];
                instanceState.current = {
                  instanceId: body.instanceId,
                  port: messagePortToSend,
                  iframe,
                };
              }

              console.log('sending port...', type, messagePortToSend);
              void sendIframeRequest(
                'RSC_CHANNEL_PORT',
                [messagePortToSend],
                iframe
              );
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
    [sandboxId, type, sendIframeRequest, messagePort, recreateMessageChannel]
  );

  useEffect(() => {
    // the other frame might have changed the port.
    const state = instanceState.current;
    if (state && state.port !== messagePort) {
      void sendIframeRequest('RSC_CHANNEL_PORT', [messagePort], state.iframe);
    }
  }, [messagePort, sendIframeRequest]);

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

      postMessage({__rsc_request: {requestId: requestId, data}}, transfer);
    });
}
