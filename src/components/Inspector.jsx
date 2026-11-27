import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Focus, Crosshair, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SPRING_BOUNCY = { type: 'spring', stiffness: 420, damping: 24, mass: 0.78 };

export default function Inspector({
  schema,
  selectedTableId,
  selectedRelationId,
  onClose,
  onSelectTable,
  onFocusTable,
  onHideTable,
}) {
  const tbl = schema && selectedTableId ? schema.tables.find((t) => t.id === selectedTableId) : null;
  const rel = schema && selectedRelationId ? schema.relations.find((r) => r.id === selectedRelationId) : null;
  const activeKey = tbl ? `tbl-${tbl.id}` : rel ? `rel-${rel.id}` : null;

  return (
    <AnimatePresence mode="wait">
      {tbl && (
        <motion.aside
          key={activeKey}
          id="inspector"
          initial={{ opacity: 0, x: 28, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 24, scale: 0.95 }}
          transition={SPRING_BOUNCY}
          className="absolute right-4 top-4 z-20 flex max-h-[calc(100%-172px)] w-[332px] flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-[0_18px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
        >
          {(() => {
            const outgoing = schema.relations.filter((r) => r.sourceTableId === tbl.id);
            const incoming = schema.relations.filter((r) => r.targetTableId === tbl.id && !r.isSelfReference);

            return (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-bold tracking-tight">{tbl.id}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {tbl.columns.length} columns · {outgoing.length} outgoing · {incoming.length} incoming
                      {tbl.isJunctionTable ? ' · Junction' : ''}
                    </div>
                  </div>
                  <Button id="btnCloseInspector" variant="ghost" size="icon-sm" title="Close" onClick={onClose}>
                    <X />
                  </Button>
                </div>

                <div className="flex flex-col gap-3.5 overflow-y-auto p-4">
                  {tbl.comment && (
                    <div className="rounded-2xl bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
                      {tbl.comment}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="default" size="sm" onClick={() => onFocusTable(tbl.id, 1)}>
                      <Focus />
                      Focus Connected
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onSelectTable(tbl.id, true)}>
                      <Crosshair />
                      Center
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onHideTable(tbl.id)}>
                      <EyeOff />
                      Hide
                    </Button>
                  </div>

                  {(outgoing.length > 0 || incoming.length > 0) && (
                    <div>
                      <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                        Connected Tables
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {outgoing.map((r) => (
                          <motion.button
                            key={`out-${r.id}`}
                            whileHover={{ scale: 1.05, y: -1 }}
                            whileTap={{ scale: 0.92 }}
                            transition={SPRING_BOUNCY}
                            onClick={() => onSelectTable(r.targetTableId, true)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 font-mono text-[11px] font-medium transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                          >
                            → {r.targetTableId} ({r.cardinality})
                          </motion.button>
                        ))}
                        {incoming.map((r) => (
                          <motion.button
                            key={`in-${r.id}`}
                            whileHover={{ scale: 1.05, y: -1 }}
                            whileTap={{ scale: 0.92 }}
                            transition={SPRING_BOUNCY}
                            onClick={() => onSelectTable(r.sourceTableId, true)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 font-mono text-[11px] font-medium transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                          >
                            ← {r.sourceTableId} ({r.cardinality})
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                      Columns ({tbl.columns.length})
                    </div>
                    <div className="divide-y divide-border">
                      {tbl.columns.map((c) => (
                        <div key={c.name} className="flex items-start justify-between gap-2.5 py-2 text-xs">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1">
                              {c.isPrimaryKey && <Badge variant="pk">PK</Badge>}
                              {c.isForeignKey && <Badge variant="fk">FK</Badge>}
                              {c.isUnique && !c.isPrimaryKey && <Badge variant="uk">UK</Badge>}
                              <strong className="font-semibold">{c.name}</strong>
                              {c.nullable && (
                                <span className="text-[10.5px] text-muted-foreground">null</span>
                              )}
                            </div>
                            {c.references && (
                              <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                                → {c.references.tableId}.{c.references.column}
                              </div>
                            )}
                            {c.comment && (
                              <div className="mt-0.5 text-[10.5px] text-muted-foreground">{c.comment}</div>
                            )}
                          </div>
                          <span
                            className="max-w-[124px] shrink-0 truncate text-right font-mono text-[11px] text-muted-foreground"
                            title={c.type}
                          >
                            {c.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </motion.aside>
      )}

      {!tbl && rel && (
        <motion.aside
          key={activeKey}
          id="inspector"
          initial={{ opacity: 0, x: 28, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 24, scale: 0.95 }}
          transition={SPRING_BOUNCY}
          className="absolute right-4 top-4 z-20 flex max-h-[calc(100%-172px)] w-[332px] flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-[0_18px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-3.5">
            <div className="min-w-0">
              <div className="break-words text-sm font-bold tracking-tight">{rel.name || 'Relationship'}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {rel.cardinality} · {rel.inferred ? 'Inferred from naming' : 'Explicit Foreign Key'}
              </div>
            </div>
            <Button id="btnCloseInspector" variant="ghost" size="icon-sm" title="Close" onClick={onClose}>
              <X />
            </Button>
          </div>

          <div className="flex flex-col gap-3.5 overflow-y-auto p-4">
            <div className="flex flex-wrap gap-1.5">
              <motion.button
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.92 }}
                transition={SPRING_BOUNCY}
                onClick={() => onSelectTable(rel.sourceTableId, true)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 font-mono text-[11px] font-medium transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                Child: {rel.sourceTableId}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.92 }}
                transition={SPRING_BOUNCY}
                onClick={() => onSelectTable(rel.targetTableId, true)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 font-mono text-[11px] font-medium transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                Parent: {rel.targetTableId}
              </motion.button>
            </div>

            <div>
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                Column Mapping
              </div>
              <div className="divide-y divide-border">
                {rel.sourceColumns.map((sc, idx) => {
                  const tc = rel.targetColumns[idx] || rel.targetColumns[0] || 'id';
                  return (
                    <div key={`${sc}-${idx}`} className="flex items-center justify-between gap-2 py-2 font-mono text-[11px]">
                      <span>
                        {rel.sourceTableId}.<strong>{sc}</strong>
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span>
                        {rel.targetTableId}.<strong>{tc}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                Properties
              </div>
              <div className="divide-y divide-border text-xs">
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Cardinality</span>
                  <strong>{rel.cardinality} ({rel.sourceEnd} → {rel.targetEnd})</strong>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">ON DELETE</span>
                  <strong>{rel.onDelete || 'NO ACTION'}</strong>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">ON UPDATE</span>
                  <strong>{rel.onUpdate || 'NO ACTION'}</strong>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Self-Referencing</span>
                  <strong>{rel.isSelfReference ? 'Yes' : 'No'}</strong>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
