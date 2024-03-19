// @ts-expect-error only installed within sandbox
import * as RSDWClient from 'react-server-dom-webpack/client';
import {callServer} from './call-server.source';

export function createServerReference(/** @type {string} */ id) {
  return RSDWClient.createServerReference(id, callServer);
}
