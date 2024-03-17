import {useCallback, useLayoutEffect, useRef} from 'react';

export function useRefCallback<TFn extends (...args: any[]) => void>(
  callback: TFn
): TFn {
  const lastComittedCallback = useRef(callback);
  useLayoutEffect(() => {
    lastComittedCallback.current = callback;
  }, [callback]);

  return useCallback((...args: Parameters<TFn>) => {
    return lastComittedCallback.current(...args);
  }, []) as TFn;
}
