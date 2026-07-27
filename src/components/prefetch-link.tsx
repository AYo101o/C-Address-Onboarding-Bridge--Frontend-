"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ComponentProps, type ReactNode } from "react";

type PrefetchLinkProps = ComponentProps<typeof Link> & {
  children: ReactNode;
  prefetchOnVisible?: boolean;
};

// Skip redundant router.prefetch() calls: once a destination is prefetched we
// never ask again, no matter how many PrefetchLink instances point at it or how
// often they enter view / are hovered. (Next already dedupes the underlying RSC
// requests per route; this just avoids the redundant calls.)
const prefetched = new Set<string>();

// A single IntersectionObserver shared by every instance, instead of allocating
// one observer per component. Each observed element maps to the prefetch
// callback to run when it scrolls within 200px of the viewport.
const targets = new WeakMap<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
    return null;
  }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          targets.get(entry.target)?.();
          sharedObserver?.unobserve(entry.target);
          targets.delete(entry.target);
        });
      },
      { rootMargin: "200px" }
    );
  }
  return sharedObserver;
}

export function PrefetchLink({ href, prefetchOnVisible = true, onMouseEnter, onFocus, ...props }: PrefetchLinkProps) {
  const router = useRouter();
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  const prefetch = useCallback(() => {
    if (typeof href !== "string" || prefetched.has(href)) {
      return;
    }
    prefetched.add(href);
    router.prefetch(href);
  }, [href, router]);

  useEffect(() => {
    const element = linkRef.current;
    if (!prefetchOnVisible || !element || typeof href !== "string" || prefetched.has(href)) {
      return;
    }

    const observer = getSharedObserver();
    if (!observer) {
      return;
    }

    targets.set(element, prefetch);
    observer.observe(element);
    return () => {
      observer.unobserve(element);
      targets.delete(element);
    };
  }, [href, prefetchOnVisible, prefetch]);

  return (
    <Link
      ref={linkRef}
      href={href}
      onMouseEnter={(event) => {
        prefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetch();
        onFocus?.(event);
      }}
      {...props}
    />
  );
}
