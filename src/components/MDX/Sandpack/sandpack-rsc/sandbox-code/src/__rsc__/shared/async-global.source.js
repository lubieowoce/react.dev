import {promiseWithResolvers} from './promise-with-resolvers.source';

/**
 * @template T
 * @returns T
 * */
export function createAsyncGlobal() {
  // TODO(graphs): this should really be an observable

  const createPromise = () => {
    /** @type {import('./promise-with-resolvers.source').PromiseWithResolvers<T>} */
    const ctrl = promiseWithResolvers();
    return ctrl;
  };

  let ctrl = createPromise();

  /** @type {T | undefined} */
  let resolved;
  return {
    get: () => ctrl.promise,
    set: (/** @type {T} */ value) => {
      if (resolved && resolved !== value) {
        ctrl = createPromise();
      }
      ctrl.resolve(value);
    },
    unset: () => {
      ctrl = createPromise();
    },
  };
}

/**
 * @template T
 * @typedef {{ get(): Promise<T>, set(value: T): void, unset(): void }} CreateAsyncGlobal<T>
 */
