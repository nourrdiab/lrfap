import { useDocumentTitle } from '../hooks/useDocumentTitle';

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
}

export function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  useDocumentTitle(title);
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-start justify-center px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-600">
        LRFAP · scaffold
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-3 max-w-xl text-base text-slate-600">{subtitle}</p>
      ) : null}
      <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        This page is a stub. Content will be built from the Figma design on request.
      </p>
    </div>
  );
}
