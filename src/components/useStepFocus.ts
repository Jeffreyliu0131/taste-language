import { useEffect, useRef } from "react";

export function useStepFocus(key: string | number) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}
