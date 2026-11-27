import React from 'react';
import { Eye, EyeOff, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Sidebar({
  open,
  schema,
  fileName,
  searchQuery,
  onSearchChange,
  searchInputRef,
  activeSchemaFilter,
  onSelectSchemaFilter,
  activeTab,
  onChangeTab,
  hiddenTableIds,
  onToggleTableVisibility,
  selectedTableId,
  onSelectTable,
  selectedRelationId,
  onSelectRelation,
}) {
  if (!open || !schema) return null;

  const q = searchQuery.trim().toLowerCase();

  const filteredTables = schema.tables.filter((t) => {
    if (activeSchemaFilter && (t.schema || '(default)') !== activeSchemaFilter) return false;
    if (!q) return true;
    return (
      t.id.toLowerCase().includes(q) ||
      t.columns.some((c) => c.name.toLowerCase().includes(q))
    );
  });

  const filteredRelations = schema.relations.filter((r) => {
    if (!q) return true;
    return (
      r.sourceTableId.toLowerCase().includes(q) ||
      r.targetTableId.toLowerCase().includes(q) ||
      r.sourceColumns.some((c) => c.toLowerCase().includes(q)) ||
      r.targetColumns.some((c) => c.toLowerCase().includes(q)) ||
      (r.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <aside
      id="sidebar"
      className="flex w-70 shrink-0 flex-col border-r border-border bg-card min-h-0"
    >
      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-1.5 border-b border-border px-3 pt-2.5 pb-2">
        <div className="rounded-md border border-border bg-secondary/60 px-2 py-1.5">
          <div id="statTables" className="font-mono text-[15px] font-bold leading-tight">
            {schema.stats.tableCount}
          </div>
          <div className="mt-0.5 text-[10.5px] text-muted-foreground">Tables</div>
        </div>
        <div className="rounded-md border border-border bg-secondary/60 px-2 py-1.5">
          <div id="statRelations" className="font-mono text-[15px] font-bold leading-tight">
            {schema.stats.relationCount}
          </div>
          <div className="mt-0.5 text-[10.5px] text-muted-foreground">Relations</div>
        </div>
        <div className="rounded-md border border-border bg-secondary/60 px-2 py-1.5">
          <div id="statColumns" className="font-mono text-[15px] font-bold leading-tight">
            {schema.stats.columnCount}
          </div>
          <div className="mt-0.5 text-[10.5px] text-muted-foreground">Columns</div>
        </div>
      </div>

      {/* File & Dialect Banner */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-3 py-1.5 text-[11.5px] text-muted-foreground">
        <span id="fileNameLabel" className="truncate font-medium">
          {fileName}
        </span>
        <Badge id="dialectBadge" variant="default" className="shrink-0 rounded-full px-2 py-0.5">
          {schema.dialect}
        </Badge>
      </div>

      {/* Search */}
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            id="searchInput"
            type="search"
            placeholder="Search tables, cols... (⌘K)"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Schema Filter Chips */}
      {schema.schemas.length > 1 && (
        <div id="schemaChips" className="flex flex-wrap gap-1 border-b border-border px-3 py-1.5">
          <button
            className={cn(
              'cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition-colors',
              !activeSchemaFilter
                ? 'border-primary bg-primary/15 font-semibold text-primary'
                : 'border-border bg-secondary/60 text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onSelectSchemaFilter(null)}
          >
            All ({schema.tables.length})
          </button>
          {schema.schemas.map((s) => {
            const count = schema.tables.filter((t) => t.schema === s).length;
            const active = activeSchemaFilter === s;
            return (
              <button
                key={s}
                className={cn(
                  'cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  active
                    ? 'border-primary bg-primary/15 font-semibold text-primary'
                    : 'border-border bg-secondary/60 text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onSelectSchemaFilter(s)}
              >
                {s} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* shadcn Radix Tabs */}
      <Tabs value={activeTab} onValueChange={onChangeTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="tables" data-tab="tables">
            Tables
          </TabsTrigger>
          <TabsTrigger value="relations" data-tab="relations">
            Relations
          </TabsTrigger>
          <TabsTrigger value="diagnostics" data-tab="diagnostics" id="tabDiagnostics">
            {schema.warnings.length > 0 ? `Info (${schema.warnings.length})` : 'Info'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" id="sidebarList">
          {filteredTables.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No matching tables</div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filteredTables.map((t) => {
                const isHidden = hiddenTableIds.has(t.id);
                const isSel = selectedTableId === t.id;
                const fkCount = t.columns.filter((c) => c.isForeignKey).length;
                const sub = `${t.columns.length} cols · ${t.primaryKeys.length} PK · ${fkCount} FK${t.isExternal ? ' · EXT' : ''}`;
                return (
                  <div
                    key={t.id}
                    data-list-table={t.id}
                    onClick={() => onSelectTable(t.id, true)}
                    className={cn(
                      'group flex cursor-pointer items-center justify-between gap-1.5 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:bg-accent',
                      isSel && 'border-primary/40 bg-primary/10',
                      isHidden && 'opacity-45'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{t.id}</div>
                      <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
                        {sub}
                      </div>
                    </div>
                    <button
                      className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title={isHidden ? 'Show table' : 'Hide table'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTableVisibility(t.id);
                      }}
                    >
                      {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="relations">
          {filteredRelations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {schema.relations.length === 0 ? (
                <>
                  No explicit foreign keys found.
                  <br />
                  <br />
                  Try enabling <strong className="text-foreground">Infer FKs</strong> in the top bar!
                </>
              ) : (
                'No matching relationships'
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredRelations.map((r) => (
                <div
                  key={r.id}
                  data-list-rel={r.id}
                  onClick={() => onSelectRelation(r.id, true)}
                  className={cn(
                    'cursor-pointer rounded-md border border-border bg-secondary/50 p-2 transition-colors hover:border-input hover:bg-accent/70',
                    selectedRelationId === r.id && 'border-primary bg-primary/10'
                  )}
                >
                  <div className="break-words font-mono text-[11px] font-semibold">
                    {r.sourceTableId}.{r.sourceColumns.join(',')} → {r.targetTableId}.{r.targetColumns.join(',')}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge variant="fk">{r.cardinality}</Badge>
                    {r.onDelete && <Badge variant="secondary">DEL: {r.onDelete}</Badge>}
                    {r.isSelfReference && <Badge variant="uk">SELF</Badge>}
                    {r.inferred && <Badge variant="warn">INFERRED</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="diagnostics">
          <div className="flex flex-col gap-2">
            <div className="rounded-md border border-border bg-secondary/50 p-2.5 text-xs">
              <div className="font-semibold">Parse Summary</div>
              <div className="mt-1.5 space-y-1 text-[11.5px] text-muted-foreground">
                <div>Dialect: <strong className="text-foreground">{schema.dialect}</strong></div>
                <div>
                  Tables: <strong className="text-foreground">{schema.stats.tableCount}</strong>
                  {schema.stats.externalTableCount > 0 && ` (+${schema.stats.externalTableCount} external stubs)`}
                </div>
                <div>Explicit FKs: <strong className="text-foreground">{schema.stats.explicitRelationCount}</strong></div>
                <div>Inferred FKs: <strong className="text-foreground">{schema.stats.inferredRelationCount}</strong></div>
                <div>Skipped non-DDL stmts: <strong className="text-foreground">{schema.stats.skippedStatements}</strong></div>
              </div>
            </div>

            {schema.enums.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  Enums ({schema.enums.length})
                </div>
                {schema.enums.map((en) => {
                  const label = en.schema ? `${en.schema}.${en.name}` : en.name;
                  return (
                    <div key={label} className="rounded-md border border-border bg-secondary/50 p-2">
                      <div className="font-mono text-[11px] font-semibold">{label}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{en.values.join(', ')}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {schema.warnings.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  Notices ({schema.warnings.length})
                </div>
                {schema.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11.5px] text-amber-600 dark:text-amber-400"
                  >
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
