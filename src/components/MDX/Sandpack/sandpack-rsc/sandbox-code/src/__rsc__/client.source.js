// @ts-check
import './webpack.source.js';

import {
  initMessaging,
  createPostMessageRequestClient,
} from './init-messaging.source.js';
import * as React from 'react';
import {
  useState,
  startTransition,
  // @ts-expect-error  not sure how to bring react/canary types into here
  use,
} from 'react';
import {createRoot} from 'react-dom/client';

// @ts-expect-error only installed within sandbox
import * as RSDWClient from 'react-server-dom-webpack/client';

/** @template T */
function promiseWithResolvers() {
  /** @type {(value: T) => void} */
  let resolve = /** @type {any} */ (undefined);
  /** @type {(error: unknown) => void} */
  let reject = /** @type {any} */ (undefined);

  /** @type {Promise<T>} */
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return {promise, resolve, reject};
}

export function initClient() {
  /** @typedef {Promise<any>} JSXPromise */
  /** @type {(promise: JSXPromise) => void} */
  let setCurrentPromise;

  /** @param {{initialPromise: JSXPromise}} props */
  function Root({initialPromise}) {
    const [promise, _setCurrentPromise] = useState(initialPromise);
    setCurrentPromise = _setCurrentPromise;
    return use(promise);
  }

  const initialPromiseCtrl = promiseWithResolvers();

  /** @type {JSXPromise | undefined} */
  let currentPromise;
  /** @type {JSXPromise | undefined} */
  let nextPromise;

  const setElementPromise = (/** @type {JSXPromise} */ promise) => {
    if (!currentPromise) {
      currentPromise = promise;
      initialPromiseCtrl.resolve(promise);
    } else {
      nextPromise = promise;
      currentPromise.finally(
        () => nextPromise && setCurrentPromise(nextPromise)
      );
    }
  };

  const root = createRoot(
    /** @type {HTMLElement} */ (document.getElementById('root'))
  );
  startTransition(() => {
    root.render(<Root initialPromise={initialPromiseCtrl.promise} />);
  });
  const cleanupDom = () => root.unmount();

  const debug = false;

  const cleanupMessaging = initMessaging((port) => {
    debug && console.debug('rsc-client :: got port');
    const sendRequest = createPostMessageRequestClient();

    const serverUpdateListener = (
      /** @type {MessageEvent<unknown>} */ event
    ) => {
      if (event.data === 'RSC_SERVER_UPDATED') {
        debug &&
          console.debug('rsc-client :: server updated, fetchServerData again');
        fetchAndUpdateServerData();
      }
    };
    port.addEventListener('message', serverUpdateListener, false);
    const cleanupServerUpdateListener = () =>
      port.removeEventListener('message', serverUpdateListener, false);

    const fetchAndUpdateServerData = async () => {
      const promise = (async () => {
        debug && console.debug('rsc-client :: requesting...');
        const responseStream = await sendRequest(undefined, undefined, {
          postMessage: (data, transfer = []) => {
            port.start();
            port.postMessage(data, transfer);
          },
          responseTarget: port,
        });
        debug && console.debug('rsc-client :: got response', responseStream);
        if (!(responseStream instanceof ReadableStream)) {
          throw new Error('Received response is not a ReadableStream');
        }

        return RSDWClient.createFromReadableStream(responseStream);
      })();

      setElementPromise(promise);
      return promise;
    };

    debug && console.debug('rsc-client :: initial fetchServerData');
    fetchAndUpdateServerData();

    return () => {
      cleanupServerUpdateListener();
    };
  });

  return () => {
    console.log('rsc-client :: cleaning up');
    cleanupDom();
    cleanupMessaging();
  };
}
