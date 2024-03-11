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
  let setCurrentPromise;
  function Root({initialPromise}) {
    const [promise, _setCurrentPromise] = useState(initialPromise);
    setCurrentPromise = _setCurrentPromise;
    return use(promise);
  }

  let didResolve = false;
  const initialPromiseCtrl = promiseWithResolvers();
  const setElementPromise = (promise) => {
    if (!didResolve) {
      initialPromiseCtrl.resolve(promise);
      didResolve = true;
    } else {
      setCurrentPromise(promise);
    }
  };

  const root = createRoot(
    /** @type {HTMLElement} */ (document.getElementById('root'))
  );
  startTransition(() => {
    root.render(<Root initialPromise={initialPromiseCtrl.promise} />);
  });

  const debug = false;

  initMessaging((port) => {
    debug && console.debug('rsc-client :: got port');
    const sendRequest = createPostMessageRequestClient();

    (async () => {
      try {
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

        const [s1, s2] = responseStream.tee();
        const elementPromise = RSDWClient.createFromReadableStream(s1);
        setElementPromise(elementPromise);

        const decoder = new TextDecoder();

        // @ts-expect-error TS doesn't understand that streams are AsyncIterable
        const s2Iterable = /** @type {AsyncIterable<Uint8Array>} */ (s2);

        for await (const chunk of s2Iterable) {
          console.log(decoder.decode(chunk));
        }
      } catch (error) {
        setElementPromise(Promise.reject(error));
      }
    })();
  });
}
