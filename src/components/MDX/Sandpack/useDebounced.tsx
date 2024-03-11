import {useRef, useState, useEffect} from 'react';

export function useDebounced<T>(value: T): T {
  const ref = useRef<any>(null);
  const [saved, setSaved] = useState(value);
  useEffect(() => {
    clearTimeout(ref.current);
    ref.current = setTimeout(() => {
      setSaved(value);
    }, 300);
  }, [value]);
  return saved;
}
