/**
 * Root not-found page. Uses plain HTML instead of client components (lucide
 * icons, Button, Link) because Next.js embeds the notFound fallback in the
 * RSC payload of every page. Client component imports here would add ~16 kB
 * gzip to every route's first-load JS.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
          aria-hidden="true"
        >
          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
          <path d="M12 17h.01" />
          <path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" />
        </svg>
        <h2 className="text-lg font-medium">Page not found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional: using <a> instead of <Link> to avoid pulling the next/link client component (~8 kB gzip) into every page's first-load JS via the notFound RSC fallback */}
        <a
          href="/"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
