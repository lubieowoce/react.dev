// @ts-check
const moduleCache = new Map();

function trackThenableState(promise) {
  if (typeof promise.status === 'string') {
    return promise;
  }
  promise.status = 'pending';
  promise.then(
    (value) => {
      promise.status = 'fulfilled';
      promise.value = value;
    },
    (error) => {
      promise.status = 'rejected';
      promise.reason = error;
    }
  );
  return promise;
}

const getOrImport = (/** @type {string} */ id) => {
  // in sandpack's case, modules and chunks are one and the same.
  if (!moduleCache.has(id)) {
    const promise = trackThenableState(import(id));
    moduleCache.set(id, promise);
  }

  return moduleCache.get(id);
};

if (typeof globalThis['__webpack_require__'] !== 'function') {
  globalThis['__webpack_chunk_load__'] = (/** @type {string} */ id) => {
    // console.log('__webpack_chunk_load__', id)

    // in sandpack's case, there is no concept of chunks.
    // but it's probably best that we have a preload-adjacent thing,
    // so in the client reference, we set the chunk to the same filename as the module,
    // and just import() it.
    // unlike __webpack_chunk_load__, this also evaluates the module,
    // but we don't really mind here.
    return getOrImport(id);
  };

  /** @type {Map<string, Promise<Record<string, unknown>>>} */
  globalThis['__webpack_require__'] = (/** @type {string} */ id) => {
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

export {};
