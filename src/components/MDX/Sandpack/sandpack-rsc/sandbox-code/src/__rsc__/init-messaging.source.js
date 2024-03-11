// @ts-check
import sandboxId from './sandbox-id.source.js';

export const replyOnWindowParent = (
  /** @type {any} */ data,
  /** @type {Transferable[] | undefined} */ transfer
) => {
  window.parent.postMessage(data, '*', transfer);
};

// this should match createPostMessageRequestClient
export function createPostMessageRequestListener(
  /** @type {(data: unknown, event: MessageEvent<unknown>) => unknown | Promise<unknown>} */ handler,
  /** @type {{ sendReply: (data: any, transfer?: Transferable[]) => void, name?: string, debug?: boolean }} */ {
    sendReply,
    name = '<unnamed server>',
    debug = false,
  }
) {
  return async (/** @type {MessageEvent<unknown>} */ event) => {
    debug && console.debug(name + ' got message', event);
    const {data} = event;
    if (!data || typeof data !== 'object') {
      return;
    }
    if (!('__rsc_request' in data)) {
      return;
    }
    debug && console.debug(name + ' got request', data.__rsc_request);

    const {requestId, data: requestData} =
      /** @type {{requestId: string, data: any}}*/ (data.__rsc_request);

    try {
      const response = await handler(requestData, event);
      debug && console.debug(name, 'responding...', {requestId});
      sendReply(
        {__rsc_response: {requestId, data: response}},
        response && typeof response === 'object'
          ? [/** @type {Transferable} */ (response)]
          : undefined
      );
    } catch (error) {
      sendReply({
        __rsc_response: {requestId, error: error.message ?? `${error}`},
      });
    }
  };
}

// this is a fork of createPostMessageRequestClient
export function createPostMessageRequestClient(idBase = '') {
  const idRef = {current: 0};
  return (
    /** @type {any} */ data,
    /** @type {any[] | undefined} */ transfer,
    /** @type {{ postMessage: (data: any, transfer: Transferable[] | undefined) => void; responseTarget: EventTarget; maxDuration?: number; }} */ options
  ) =>
    new Promise((resolve, reject) => {
      const requestId = idBase + idRef.current++;
      const {postMessage, responseTarget, maxDuration = 10_000} = options;

      const timeout = setTimeout(() => {
        reject(
          new Error(
            'Did not receive response within ' + maxDuration / 1000 + 's'
          )
        );
        cleanup();
      }, 10_000);

      const responseHandler = (/** @type {MessageEvent<unknown>} */ event) => {
        const {data} = event;
        if (
          !data ||
          typeof data !== 'object' ||
          !('__rsc_response' in data) ||
          !data.__rsc_response
        ) {
          return;
        }

        const response =
          /** @type {{requestId: string} & ({data: unknown} | {error: string})} */ (
            data.__rsc_response
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
        /** @type {EventListener} */ (responseHandler),
        false
      );
      const cleanup = () =>
        responseTarget.removeEventListener(
          'message',
          /** @type {EventListener} */ (responseHandler),
          false
        );

      postMessage({__rsc_request: {requestId: requestId, data}}, transfer);
    });
}

export function initMessaging(
  /** @type {(port: MessagePort) => (void | (() => void))} */ onPortReceived
) {
  /** @type {void | (() => void)} */
  let previousCleanupUserHandler;

  const cleanupPreviousUserHandler = () => {
    if (previousCleanupUserHandler) {
      previousCleanupUserHandler();
    }
  };

  const cleanupPortListener = addMessageListenerWithCleanup(
    createPostMessageRequestListener(
      (data, event) => {
        if (data === 'RSC_CHANNEL_PORT') {
          const port = event.ports[0];
          // console.debug(
          //   `initMessaging[${sandboxId}] :: received MessagePort`,
          //   port
          // );
          cleanupPreviousUserHandler();
          previousCleanupUserHandler = onPortReceived(port);
        }
      },
      {sendReply: replyOnWindowParent}
    )
  );

  const instanceId = Date.now() + '';
  // console.debug(
  //   `initMessaging[${sandboxId}] :: sending __rsc_init message to parent`
  // );
  window.parent.postMessage({__rsc_init: {sandboxId, instanceId}}, '*');

  return () => {
    cleanupPreviousUserHandler();
    cleanupPortListener();
  };
}

function addMessageListenerWithCleanup(
  /** @type {(event: MessageEvent<unknown>) => void} */ listener
) {
  const cleanup = () => {
    window.removeEventListener('message', listener, false);
  };
  window.addEventListener('message', listener, false);
  return cleanup;
}
