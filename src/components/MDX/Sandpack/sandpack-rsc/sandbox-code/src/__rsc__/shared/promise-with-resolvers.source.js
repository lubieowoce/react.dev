/** @template T */
export function promiseWithResolvers() {
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

/**
 * @template T
 * @typedef {{ promise: Promise<T>, resolve: (value: T) => void, reject: (reason: unknown) => void }} PromiseWithResolvers<T>
 * */
