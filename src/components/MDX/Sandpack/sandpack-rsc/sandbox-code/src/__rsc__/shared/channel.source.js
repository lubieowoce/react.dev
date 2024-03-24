import {createAsyncGlobal} from './async-global.source';

/** @typedef {import("./async-global.source").CreateAsyncGlobal<() => Promise<ReadableStream>>} ServerRequestGlobal */

// stash it on window in case we get two copies of this module
/** @type {ServerRequestGlobal} */
export const serverRequestGlobal =
  // @ts-expect-error
  window['sandpack-rsc.serverRequestGlobal'] ||
  // @ts-expect-error
  (window['sandpack-rsc.serverRequestGlobal'] = createAsyncGlobal());

/** @typedef {import("./async-global.source").CreateAsyncGlobal<(actionId: string, data: string | FormData | URLSearchParams) => Promise<ReadableStream>>} ServerActionGlobal */

// stash it on window in case we get two copies of this module
/** @type {ServerActionGlobal} */
export const serverActionGlobal =
  // @ts-expect-error
  window['sandpack-rsc.serverActionGlobal'] ||
  // @ts-expect-error
  (window['sandpack-rsc.serverActionGlobal'] = createAsyncGlobal());

/** @typedef {import("./async-global.source").CreateAsyncGlobal<{ target: EventTarget }>} ServerUpdateGlobal */

// stash it on window in case we get two copies of this module
/** @type {ServerUpdateGlobal} */
export const serverUpdateGlobal =
  // @ts-expect-error
  window['sandpack-rsc.serverUpdateGlobal'] ||
  // @ts-expect-error
  (window['sandpack-rsc.serverUpdateGlobal'] = createAsyncGlobal());
