// @ts-check

/**
 * @template T
 * @typedef {Promise<T> & { status: 'pending' }} PendingThenable<T>
 */

/**
 * @template T
 * @typedef {Promise<T> & { status: 'fulfilled', value: T }} FulfilledThenable<T>
 */

/**
 * @template T
 * @typedef {Promise<T> & { status: 'rejected', reason: unknown }} RejectedThenable<T>
 */

/**
 * @template T
 * @typedef {PendingThenable<T> | FulfilledThenable<T> | RejectedThenable<T>} Thenable<T>
 */

/** @template T */
function trackThenableState(/** @type {Promise<T>} */ promise) {
  const thenable = /** @type {Thenable<T>} */ (promise);
  if ('status' in thenable && typeof thenable.status === 'string') {
    return thenable;
  }
  thenable.status = 'pending';
  thenable.then(
    (value) => {
      const fulfilledThenable = /** @type {FulfilledThenable<T>} */ (thenable);
      fulfilledThenable.status = 'fulfilled';
      fulfilledThenable.value = value;
    },
    (error) => {
      const rejectedThenable = /** @type {RejectedThenable<T>} */ (thenable);
      rejectedThenable.status = 'rejected';
      rejectedThenable.reason = error;
    }
  );
  return thenable;
}

/** @template T */
function bang(/** @type {T} */ value) {
  return /** @type {NonNullable<T>} */ (value);
}

export function installWebpackGlobals({
  __webpack_chunk_load__: chunkLoadName = '__webpack_chunk_load__',
  __webpack_require__: requireName = '__webpack_require__',
}) {
  /** @type {Map<string, Thenable<Record<string, unknown>>>} */
  const moduleCache = new Map();

  const getOrImport = (/** @type {string} */ id) => {
    // in sandpack's case, modules and chunks are one and the same.
    if (!moduleCache.has(id)) {
      const promise = trackThenableState(import(id));
      moduleCache.set(id, promise);
    }

    return bang(moduleCache.get(id));
  };

  // @ts-expect-error too lazy to type this
  if (typeof globalThis[requireName] !== 'function') {
    // @ts-expect-error too lazy to type this
    globalThis[chunkLoadName] = (/** @type {string} */ id) => {
      // console.log('__webpack_chunk_load__', id)

      // in sandpack's case, there is no concept of chunks.
      // but it's probably best that we have a preload-adjacent thing,
      // so in the client reference, we set the chunk to the same filename as the module,
      // and just import() it.
      // unlike __webpack_chunk_load__, this also evaluates the module,
      // but we don't really mind here.
      return getOrImport(id);
    };

    // @ts-expect-error too lazy to type this
    globalThis[requireName] = (/** @type {string} */ id) => {
      // console.log('__webpack_require__', id);

      const promise = getOrImport(id);
      // this is important because we can't easily get $$async set on our references,
      // and our imports are always async.
      // luckily, we always preload the modules, so this should be fulfilled at this point.
      if (promise.status === 'fulfilled') {
        return promise.value;
      }
      return promise;
    };
  }
}
