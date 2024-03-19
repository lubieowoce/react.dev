// @ts-check

import './webpack.server.source.js';
import * as React from 'react';

// @ts-expect-error only installed within sandbox
import * as RSDWServer from 'react-server-dom-webpack/server';
import {
  serverActionGlobal,
  serverRequestGlobal,
  serverUpdateGlobal,
} from './channel.source.js';
import {resolveActionFromId} from './register-server-reference.source.js';

const isDebug = false;
const debug = isDebug ? console.debug.bind(console) : undefined;

export function initServer(/** @type {() => React.FC}*/ getAppComponent) {
  serverUpdateGlobal.set({target: new EventTarget()});
  const sendServerUpdate = () => {
    return serverUpdateGlobal.get().then(({target}) => {
      target.dispatchEvent(new Event('server-update'));
    });
  };
  setupReactRefresh(sendServerUpdate);

  const moduleMap = createModuleMap();

  serverRequestGlobal.set(async function handleRenderRequest() {
    debug?.('rsc-server :: got request');
    const AppComponent = getAppComponent();
    const rootElement = <AppComponent />;

    const stream = await RSDWServer.renderToReadableStream(
      rootElement,
      moduleMap,
      {onError: console.error}
    );
    return stream;
  });

  serverActionGlobal.set(async function handleCallServer(actionId, data) {
    debug?.('rsc-server :: got action call', actionId, data);
    const action = await resolveActionFromId(actionId);
    debug?.('rsc-server :: resolved action', action);
    const args = await RSDWServer.decodeReply(data);
    const resultPromise = action.apply(null, args);
    try {
      // Wait for any mutations
      await resultPromise;
    } catch (x) {
      // We handle the error on the client
    }

    const AppComponent = getAppComponent();
    return RSDWServer.renderToReadableStream(
      {root: <AppComponent />, returnValue: resultPromise},
      moduleMap
    );
  });

  return () => {
    serverRequestGlobal.unset();
    serverUpdateGlobal.unset();
    serverActionGlobal.unset();
  };
}

function createModuleMap() {
  return new Proxy(/** @type {Record<string, any>} */ ({}), {
    get(target, /** @type {string} */ key) {
      if (key in target) {
        return target[key];
      }
      const [moduleUrl, exportName] = /** @type {string} */ (key).split('#');
      const prefix = 'file://';
      const moduleName = moduleUrl.startsWith(prefix)
        ? moduleUrl.slice(prefix.length)
        : moduleUrl;
      // console.log('moduleMap', { moduleName, exportName });
      const entry = {
        id: moduleName,
        chunks: [moduleName],
        name: exportName || 'default',
        async: true,
      };
      console.log('moduleMap', key, entry);
      target[key] = entry;
      return entry;
    },
  });
}

function setupReactRefresh(/** @type {() => void} */ onUpdate) {
  // @ts-expect-error
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const rendererId = hook?.inject({
    scheduleRefresh: (
      /** @type {any} */ root,
      /** @type {{updatedFamilies: Set<{ current: unknown}>, staleFamilies: Set<unknown>}} */ update
    ) => {
      debug?.(`rsc-server (${rendererId}) :: scheduleRefresh`, root, update);
      onUpdate();
    },
    performReactRefresh: (/** @type {any[]} */ ...args) => {
      debug?.(`rsc-server (${rendererId}) :: performReactRefresh`, ...args);
      onUpdate();
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
}
