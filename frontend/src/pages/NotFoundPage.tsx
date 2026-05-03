import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-600">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-3 text-sm text-slate-600">
        The page you were looking for doesn’t exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B2545]/90"
      >
        Back to home
      </Link>
    </div>
  );
}
