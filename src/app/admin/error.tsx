"use client";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
      <h2 className="text-lg font-extrabold text-red-700">That didn&apos;t work</h2>
      <p className="mt-2 text-sm text-muted">{error.message?.length < 160 ? error.message : "An unexpected error occurred."}</p>
      <button onClick={reset} className="btn-dark mt-5">Try again</button>
    </div>
  );
}
