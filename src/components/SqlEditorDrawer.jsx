import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const lineCount = sql ? sql.split(/\r?\n/).length : 0;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          id="sqlDrawer"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 420, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-card min-h-0"
        >
          <div className="flex h-full w-[420px] flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <span id="editorTitle" className="truncate text-xs font-semibold tracking-tight">
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
              className="flex-1 w-full resize-none border-none bg-secondary/40 p-4 font-mono text-xs leading-relaxed text-foreground outline-none"
            />

            <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2 text-[11px] text-muted-foreground">
              <span id="editorStats" className="font-mono">{lineCount.toLocaleString()} lines</span>
              <span>Live auto-parse · 100% offline</span>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
