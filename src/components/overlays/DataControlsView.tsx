'use client';

import { useState } from 'react';

interface DataControlsViewProps {
  onBack: () => void;
  onTrackExport?: () => void;
  onTrackDelete?: () => void;
}

export function DataControlsView({ onBack, onTrackExport, onTrackDelete }: DataControlsViewProps) {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Export failed');
      onTrackExport?.();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `colourmap-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Best-effort
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/data', { method: 'DELETE' });
      if (res.ok) {
        onTrackDelete?.();
        window.location.reload();
      }
    } catch {
      // Best-effort
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#060a12]">
      <div className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          aria-label="Back"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-light tracking-wide text-white/70">Data & privacy</h1>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-8">
        <p className="text-sm text-white/50">
          Colour Map is not therapy, not medical advice, not a crisis service. Your data stays
          yours.
        </p>

        <section>
          <h2 className="mb-2 text-sm font-medium text-white/60">Export your data</h2>
          <p className="mb-3 text-xs text-white/40">
            Download a JSON file with your state, sessions, practices, and principles.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06] disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export data'}
          </button>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-white/60">Delete all data</h2>
          <p className="mb-3 text-xs text-white/40">
            Permanently delete all your data. This cannot be undone. You will need to start over.
          </p>
          {!deleteConfirm ? (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 hover:bg-white/[0.03] hover:text-white/70"
            >
              I want to delete my data
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-amber-400/80">
                Are you sure? This will delete everything.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete everything'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
