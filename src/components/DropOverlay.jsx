import React from 'react';
import { Upload } from 'lucide-react';

export default function DropOverlay({ visible }) {
  if (!visible) return null;

  return (
    <div
      id="dropOverlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs"
    >
      <div className="rounded-2xl border-2 border-dashed border-primary bg-card px-12 py-9 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <h2 className="text-base font-bold">Drop your .sql file to visualize</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Parsed 100% offline inside your browser — no data ever leaves your device.
        </p>
      </div>
    </div>
  );
}
