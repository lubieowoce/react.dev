// @ts-expect-error only installed within sandbox
import * as RSDWClient from 'react-server-dom-webpack/client';
import {startTransition} from 'react';
import {serverActionGlobal} from './channel.source';

const isDebug = false;
const debug = isDebug ? console.debug.bind(console) : undefined;

export function createCallServer(
  /** @type {(newRoot: import('react').ReactNode) => void} */ updateRoot
) {
  return async function callServer(
    /** @type {string}*/ id,
    /** @type {unknown[]}*/ args
  ) {
    debug?.('rsc-client :: callServer', id, args);
    const sendAction = await serverActionGlobal.get();
    const stream = await sendAction(id, await RSDWClient.encodeReply(args));
    debug?.('rsc-client :: got response stream');

    const {root, returnValue} = await RSDWClient.createFromReadableStream(
      stream,
      {
        callServer,
      }
    );

    if (!updateRoot) {
      throw new Error('No updateRoot function set');
    }
    startTransition(() => {
      updateRoot(root);
    });
    Promise.resolve(returnValue).then((res) =>
      debug?.('rsc-client :: result', res)
    );
    return returnValue;
  };
}

/** @typedef {ReturnType<typeof createCallServer>} CallServer */

/** @type {CallServer | undefined} */
let callServerImpl;
export function installGlobalCallServer(/** @type {CallServer} */ impl) {
  callServerImpl = impl;
}

export async function callServer(
  /** @type {string}*/ id,
  /** @type {unknown[]}*/ args
) {
  if (!callServerImpl) {
    throw new Error('callServer not set');
  }
  return callServerImpl(id, args);
}
