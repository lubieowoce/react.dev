// @ts-check
import './webpack.client.source.js';

import * as React from 'react';
import {
  useState,
  startTransition,
  // @ts-expect-error  not sure how to bring react/canary types into here
  use,
} from 'react';
import {createRoot} from 'react-dom/client';

const isDebug = false;
const debug = isDebug ? console.debug.bind(console) : undefined;

// @ts-expect-error only installed within sandbox
import * as RSDWClient from 'react-server-dom-webpack/client';
import {promiseWithResolvers} from './promise-with-resolvers.source.js';
import {serverRequestGlobal, serverUpdateGlobal} from './channel.source.js';

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

  const fetchAndUpdateServerData = async () => {
    const promise = (async () => {
      debug?.('rsc-client :: requesting...');
      const fetchData = await serverRequestGlobal.get();
      const responseStream = await fetchData();
      debug?.('rsc-client :: got response', responseStream);
      if (!(responseStream instanceof ReadableStream)) {
        throw new Error('Received response is not a ReadableStream');
      }
      return RSDWClient.createFromReadableStream(responseStream);
    })();

    setElementPromise(promise);
    return promise;
  };

  // @ts-ignore
  window.__RSC_REFETCH__ = fetchAndUpdateServerData;

  debug?.('rsc-client :: initial fetchServerData');
  fetchAndUpdateServerData();
  serverUpdateGlobal.get().then(({target}) => {
    target.addEventListener('server-update', () => {
      fetchAndUpdateServerData();
    });
  });

  return () => {
    console.log('rsc-client :: cleaning up');
    cleanupDom();
  };
}
