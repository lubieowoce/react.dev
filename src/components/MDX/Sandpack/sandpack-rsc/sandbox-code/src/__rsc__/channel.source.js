import {createAsyncGlobal} from './async-global.source';

/** @typedef {import("./async-global.source").CreateAsyncGlobal<() => Promise<ReadableStream>>} ServerRequestGlobal */

// stash it on window in case we get two copies of this module
/** @type {ServerRequestGlobal} */
export const serverRequestGlobal =
  // @ts-expect-error
  window.__serverRequestGlobal ||
  // @ts-expect-error
  (window.__serverRequestGlobal = createAsyncGlobal());

/** @typedef {import("./async-global.source").CreateAsyncGlobal<{ target: EventTarget }>} ServerUpdateGlobal */

// stash it on window in case we get two copies of this module
/** @type {ServerUpdateGlobal} */
export const serverUpdateGlobal =
  // @ts-expect-error
  window.__serverUpdateGlobal ||
  // @ts-expect-error
  (window.__serverUpdateGlobal = createAsyncGlobal());
