"use client";

import { useEffect, useRef } from "react";
import { registerServiceWorker } from "@/lib/serviceWorker";

/**
 * Registers the service worker once on mount. Renders nothing.
 *
 * `registerServiceWorker` is a no-op unless NEXT_PUBLIC_ENABLE_SW=true and the
 * browser supports workers, and it never throws — a failed registration must
 * not break app boot. (#345)
 */
export function ServiceWorkerRegistrar() {
  const registered = useRef(false);

  useEffect(() => {
    // Strict mode remounts effects; guard so we only register once.
    if (registered.current) return;
    registered.current = true;
    void registerServiceWorker();
  }, []);

  return null;
}
