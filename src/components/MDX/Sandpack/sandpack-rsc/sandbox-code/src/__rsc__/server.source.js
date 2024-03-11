// @ts-check

import './webpack.source.js';

import {
  initMessaging,
  createPostMessageRequestListener,
} from './init-messaging.source.js';

import * as React from 'react';

// @ts-expect-error only installed within sandbox
import * as RSDWServer from 'react-server-dom-webpack/server';

const debug = false;

export function initServer(/** @type {React.FC}*/ AppComponent) {
  const handleRenderRequest = async () => {
    // @ts-expect-error what is typescript complaining about here? who knows
    const rootElement = <AppComponent />;

    const stream = await RSDWServer.renderToReadableStream(
      rootElement,
      moduleMap,
      {onError: console.error}
    );
    return stream;
  };

  const moduleMap = new Proxy(
    {},
    {
      get(_, key) {
        const [moduleUrl, exportName] = /** @type {string} */ (key).split('#');
        const prefix = 'file://';
        const moduleName = moduleUrl.startsWith(prefix)
          ? moduleUrl.slice(prefix.length)
          : moduleUrl;
        // console.log('moduleMap', { moduleName, exportName });
        return {
          id: moduleName,
          chunks: [moduleName],
          name: exportName,
          async: true,
        };
      },
    }
  );

  const cleanupMessaging = initMessaging((port) => {
    debug &&
      console.debug('rsc-server :: attaching request listener to port', port);

    const requestListener = createPostMessageRequestListener(
      (data) => {
        if (data) {
          return;
        }
        return handleRenderRequest();
      },
      {
        sendReply: (data, transfer = []) => port.postMessage(data, transfer),
        name: 'rsc-server :: RSC_CHANNEL_PORT',
        debug,
      }
    );
    port.addEventListener('message', requestListener);
    port.start();
    debug && console.debug('rsc-server :: listening');
    return () => {
      port.removeEventListener('message', requestListener);
    };
  });

  return cleanupMessaging;
}
