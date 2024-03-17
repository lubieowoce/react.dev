// @ts-check

import './webpack.server.source.js';
import * as React from 'react';

// @ts-expect-error only installed within sandbox
import * as RSDWServer from 'react-server-dom-webpack/server';
import {serverRequestGlobal, serverUpdateGlobal} from './channel.source.js';

const isDebug = false;
const debug = isDebug ? console.debug.bind(console) : undefined;

export function initServer(/** @type {() => React.FC}*/ getAppComponent) {
  // @ts-expect-error
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const rendererId = hook?.inject({
    scheduleRefresh: (
      /** @type {any} */ root,
      /** @type {{updatedFamilies: Set<{ current: unknown}>, staleFamilies: Set<unknown>}} */ update
    ) => {
      debug?.(`rsc-server (${rendererId}) :: scheduleRefresh`, root, update);
      sendServerUpdate();
    },
    performReactRefresh: (/** @type {any[]} */ ...args) => {
      debug?.(`rsc-server (${rendererId}) :: performReactRefresh`, ...args);
      sendServerUpdate();
    },
    setRefreshHandler: (/** @type {any} */ handler) => {
      debug?.(`rsc-server (${rendererId}) :: setRefreshHandler`, handler);
    },
  });

  debug?.('rsc-server :: injected hook', rendererId);

  hook?.onCommitFiberRoot(
    rendererId,
    // root
    {
      current: {
        memoizedState: {element: {}},
        alternate: null,
        // alternate: {memoizedState: {element: {}}},
      },
    },
    // maybePriorityLevel
    undefined,
    // didError
    false
  );

  const sendServerUpdate = () => {
    return serverUpdateGlobal.get().then(({target}) => {
      target.dispatchEvent(new Event('server-update'));
    });
  };

  const handleRenderRequest = async () => {
    debug?.('rsc-server :: got request');
    const AppComponent = getAppComponent();
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

  serverRequestGlobal.set(handleRenderRequest);
  serverUpdateGlobal.set({target: new EventTarget()});

  return () => {
    serverRequestGlobal.unset();
    serverUpdateGlobal.unset();
  };
}
