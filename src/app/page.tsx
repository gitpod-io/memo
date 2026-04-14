export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Memo
        </h1>
        <p className="text-xl text-zinc-500 dark:text-zinc-400">
          A Notion-style workspace, built with zero human code.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="https://github.com/gitpod-io/memo"
            className="inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Source
          </a>
        </div>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 pt-8">
          Every line of code in this repository is written by AI agents.
        </p>
      </div>
    </main>
  );
}
