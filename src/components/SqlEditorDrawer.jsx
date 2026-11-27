import React from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SqlEditorDrawer({
  open,
  fileName,
  sql,
  onChangeSql,
  onClear,
  onClose,
  editorRef,
}) {
  if (!open) return null;

  const lineCount = sql ? sql.split(/\r?\n/).length : 0;

  return (
    <section
      id="sqlDrawer"
      className="flex w-[420px] shrink-0 flex-col border-r border-border bg-card min-h-0"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span id="editorTitle" className="truncate text-xs font-semibold">
          {fileName}
        </span>
        <div className="flex items-center gap-1.5">
          <Button id="btnClearSql" variant="outline" size="sm" onClick={onClear}>
            <Trash2 />
            Clear
          </Button>
          <Button id="btnCloseEditor" variant="outline" size="sm" onClick={onClose}>
            <X />
            Hide
          </Button>
        </div>
      </div>

      <textarea
        ref={editorRef}
        id="sqlEditor"
        spellCheck={false}
        placeholder="Paste CREATE TABLE / ALTER TABLE SQL here, or drop any .sql file onto the window..."
        value={sql}
        onChange={(e) => onChangeSql(e.target.value)}
        className="flex-1 w-full resize-none border-none bg-background p-3 font-mono text-xs leading-relaxed text-foreground outline-none"
      />

      <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span id="editorStats">{lineCount.toLocaleString()} lines</span>
        <span>Live auto-parse enabled (100% offline)</span>
      </div>
    </section>
  );
}
