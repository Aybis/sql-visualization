import React from 'react';
import { X, Focus, Crosshair, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Inspector({
  schema,
  selectedTableId,
  selectedRelationId,
  onClose,
  onSelectTable,
  onFocusTable,
  onHideTable,
}) {
  if (!schema) return null;

  if (selectedTableId) {
    const tbl = schema.tables.find((t) => t.id === selectedTableId);
    if (!tbl) return null;

    const outgoing = schema.relations.filter((r) => r.sourceTableId === tbl.id);
    const incoming = schema.relations.filter((r) => r.targetTableId === tbl.id && !r.isSelfReference);

    return (
      <Card
        id="inspector"
        className="absolute right-3.5 top-3.5 z-20 flex max-h-[calc(100%-166px)] w-80 flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border bg-secondary/60 px-3.5 py-3">
          <div className="min-w-0">
            <div className="break-words text-sm font-bold">{tbl.id}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {tbl.columns.length} columns · {outgoing.length} outgoing · {incoming.length} incoming
              {tbl.isJunctionTable ? ' · Junction Table' : ''}
            </div>
          </div>
          <Button id="btnCloseInspector" variant="ghost" size="icon-sm" title="Close" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-3.5">
          {tbl.comment && (
            <div className="rounded-md bg-secondary/70 p-2 text-xs text-muted-foreground">
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
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                Connected Tables
              </div>
              <div className="flex flex-wrap gap-1.5">
                {outgoing.map((r) => (
                  <button
                    key={`out-${r.id}`}
                    onClick={() => onSelectTable(r.targetTableId, true)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-secondary/70 px-2 py-1 font-mono text-[11px] transition-colors hover:border-primary hover:text-primary"
                  >
                    → {r.targetTableId} ({r.cardinality})
                  </button>
                ))}
                {incoming.map((r) => (
                  <button
                    key={`in-${r.id}`}
                    onClick={() => onSelectTable(r.sourceTableId, true)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-secondary/70 px-2 py-1 font-mono text-[11px] transition-colors hover:border-primary hover:text-primary"
                  >
                    ← {r.sourceTableId} ({r.cardinality})
                  </button>
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
                <div key={c.name} className="flex items-start justify-between gap-2.5 py-1.5 text-xs">
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
                      <div className="mt-0.5 font-mono text-[10.5px] text-primary">
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
      </Card>
    );
  }

  if (selectedRelationId) {
    const rel = schema.relations.find((r) => r.id === selectedRelationId);
    if (!rel) return null;

    return (
      <Card
        id="inspector"
        className="absolute right-3.5 top-3.5 z-20 flex max-h-[calc(100%-166px)] w-80 flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border bg-secondary/60 px-3.5 py-3">
          <div className="min-w-0">
            <div className="break-words text-sm font-bold">{rel.name || 'Relationship'}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {rel.cardinality} · {rel.inferred ? 'Inferred from naming' : 'Explicit Foreign Key'}
            </div>
          </div>
          <Button id="btnCloseInspector" variant="ghost" size="icon-sm" title="Close" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-3.5">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onSelectTable(rel.sourceTableId, true)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-secondary/70 px-2 py-1 font-mono text-[11px] transition-colors hover:border-primary hover:text-primary"
            >
              Child: {rel.sourceTableId}
            </button>
            <button
              onClick={() => onSelectTable(rel.targetTableId, true)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-secondary/70 px-2 py-1 font-mono text-[11px] transition-colors hover:border-primary hover:text-primary"
            >
              Parent: {rel.targetTableId}
            </button>
          </div>

          <div>
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Column Mapping
            </div>
            <div className="divide-y divide-border">
              {rel.sourceColumns.map((sc, idx) => {
                const tc = rel.targetColumns[idx] || rel.targetColumns[0] || 'id';
                return (
                  <div key={`${sc}-${idx}`} className="flex items-center justify-between gap-2 py-1.5 font-mono text-[11px]">
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
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Cardinality</span>
                <strong>{rel.cardinality} ({rel.sourceEnd} → {rel.targetEnd})</strong>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">ON DELETE</span>
                <strong>{rel.onDelete || 'NO ACTION'}</strong>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">ON UPDATE</span>
                <strong>{rel.onUpdate || 'NO ACTION'}</strong>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Self-Referencing</span>
                <strong>{rel.isSelfReference ? 'Yes' : 'No'}</strong>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
