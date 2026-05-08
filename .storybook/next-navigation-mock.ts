/**
 * Mock for next/navigation used by Storybook.
 * Provides no-op implementations of the App Router hooks so components
 * that call useRouter(), usePathname(), etc. render without crashing.
 */

const noop = () => {};

export function useRouter() {
  return {
    back: noop,
    forward: noop,
    refresh: noop,
    push: noop,
    replace: noop,
    prefetch: noop,
  };
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function useSelectedLayoutSegment() {
  return null;
}

export function useSelectedLayoutSegments() {
  return [];
}

export function redirect() {
  return undefined;
}

export function notFound() {
  return undefined;
}
