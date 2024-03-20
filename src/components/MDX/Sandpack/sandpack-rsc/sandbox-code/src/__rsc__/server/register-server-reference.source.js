// @ts-expect-error only installed within sandbox
import * as RSDWServer from 'react-server-dom-webpack/server';

/** @typedef {Record<string, (...args: unknown[]) => Promise<unknown>>} ServerActionsRegistry*/

/** @returns {ServerActionsRegistry} */
function getServerActionsRegistry() {
  return (
    // @ts-expect-error global
    globalThis.__serverActionsRegistry ||
    // @ts-expect-error global
    (globalThis.__serverActionsRegistry = {})
  );
}

export async function resolveActionFromId(/** @type {string} */ actionId) {
  const serverActionsRegistry = getServerActionsRegistry();
  let action = serverActionsRegistry[actionId];
  if (!action) {
    // if nothing from the server graph loaded the action, the registry won't have it.
    // import it now.
    action = await importAction(actionId).catch(() => undefined);
  }
  if (!action) {
    throw new Error(`Internal error: Action "${actionId}" not found`);
  }
  return action;
}

async function importAction(/** @type {string} */ actionId) {
  const [moduleUrl, name] = actionId.split('#', 2);
  const modulePath = new URL(moduleUrl).pathname;
  return import(modulePath).then((mod) => mod[name]);
}

export function registerServerReference(
  /** @type {(...args: any[]) => Promise<any>} */ impl,
  /** @type {string}*/ moduleId,
  /** @type {string} */ name
) {
  const ret = RSDWServer.registerServerReference(impl, moduleId, name);
  const id = moduleId + '#' + name;

  const serverActionsRegistry = getServerActionsRegistry();
  serverActionsRegistry[id] = impl;

  return ret;
}
