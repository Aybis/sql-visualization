import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const SPRING_BOUNCY = { type: 'spring', stiffness: 460, damping: 28, mass: 0.75 };

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
  const q = searchQuery.trim().toLowerCase();

  const filteredTables = schema
    ? schema.tables.filter((t) => {
        if (activeSchemaFilter && (t.schema || '(default)') !== activeSchemaFilter) return false;
        if (!q) return true;
        return (
          t.id.toLowerCase().includes(q) ||
          t.columns.some((c) => c.name.toLowerCase().includes(q))
        );
      })
    : [];

  const filteredRelations = schema
    ? schema.relations.filter((r) => {
        if (!q) return true;
        return (
          r.sourceTableId.toLowerCase().includes(q) ||
          r.targetTableId.toLowerCase().includes(q) ||
          r.sourceColumns.some((c) => c.toLowerCase().includes(q)) ||
          r.targetColumns.some((c) => c.toLowerCase().includes(q)) ||
          (r.name || '').toLowerCase().includes(q)
        );
      })
    : [];

  const tabs = [
    { id: 'tables', label: 'Tables' },
    { id: 'relations', label: 'Relations' },
    {
      id: 'diagnostics',
      label: schema?.warnings.length > 0 ? `Info (${schema.warnings.length})` : 'Info',
    },
  ];

  return (
    <AnimatePresence initial={false}>
      {open && schema && (
        <motion.aside
          id="sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 288, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-card min-h-0"
        >
          <div className="flex h-full w-[288px] flex-col min-h-0">
            {/* Minimalist Airbnb Stats Strip */}
            <div className="grid grid-cols-3 gap-2 px-3.5 pt-3.5 pb-2.5">
              {[
                { id: 'statTables', label: 'Tables', value: schema.stats.tableCount },
                { id: 'statRelations', label: 'Relations', value: schema.stats.relationCount },
                { id: 'statColumns', label: 'Columns', value: schema.stats.columnCount },
              ].map((stat) => (
                <motion.div
                  key={stat.id}
                  whileHover={{ y: -2, scale: 1.03 }}
                  transition={SPRING_BOUNCY}
                  className="rounded-2xl border border-border bg-secondary/70 px-2.5 py-2"
                >
                  <div id={stat.id} className="font-mono text-base font-bold tracking-tight leading-tight">
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* File & Dialect Pill */}
            <div className="mx-3.5 mb-2.5 flex items-center justify-between gap-2 rounded-xl bg-secondary/70 px-3 py-1.5 text-[11.5px] text-muted-foreground">
              <span id="fileNameLabel" className="truncate font-medium text-foreground">
                {fileName}
              </span>
              <Badge id="dialectBadge" variant="pk" className="shrink-0">
                {schema.dialect}
              </Badge>
            </div>

            {/* Airbnb Pill Search Bar */}
            <div className="px-3.5 pb-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  id="searchInput"
                  type="search"
                  placeholder="Search tables, cols... (⌘K)"
                  className="pl-8.5"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            </div>

            {/* Bouncy Schema Filter Chips */}
            {schema.schemas.length > 1 && (
              <div id="schemaChips" className="flex flex-wrap gap-1.5 px-3.5 pb-2.5">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  transition={SPRING_BOUNCY}
                  className={cn(
                    'cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    !activeSchemaFilter
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:border-input hover:text-foreground'
                  )}
                  onClick={() => onSelectSchemaFilter(null)}
                >
                  All ({schema.tables.length})
                </motion.button>
                {schema.schemas.map((s) => {
                  const count = schema.tables.filter((t) => t.schema === s).length;
                  const active = activeSchemaFilter === s;
                  return (
                    <motion.button
                      key={s}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING_BOUNCY}
                      className={cn(
                        'cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border bg-card text-muted-foreground hover:border-input hover:text-foreground'
                      )}
                      onClick={() => onSelectSchemaFilter(s)}
                    >
                      {s} ({count})
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Phantom Wallet Bouncy Sliding Pill Tabs */}
            <div className="px-3.5 pb-2">
              <div
                role="tablist"
                className="relative grid grid-cols-3 rounded-full bg-secondary p-1"
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      data-tab={tab.id}
                      id={tab.id === 'diagnostics' ? 'tabDiagnostics' : undefined}
                      onClick={() => onChangeTab(tab.id)}
                      className={cn(
                        'relative z-10 cursor-pointer rounded-full py-1.5 text-[11.5px] font-semibold transition-colors',
                        isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sidebarTabPill"
                          transition={{ type: 'spring', stiffness: 480, damping: 28 }}
                          className="absolute inset-0 -z-10 rounded-full bg-primary shadow-sm"
                        />
                      )}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Content List */}
            <div id="sidebarList" className="flex-1 overflow-y-auto px-2.5 pb-3 pt-1">
              {activeTab === 'tables' && (
                filteredTables.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">No matching tables</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredTables.map((t) => {
                      const isHidden = hiddenTableIds.has(t.id);
                      const isSel = selectedTableId === t.id;
                      const fkCount = t.columns.filter((c) => c.isForeignKey).length;
                      const sub = `${t.columns.length} cols · ${t.primaryKeys.length} PK · ${fkCount} FK${t.isExternal ? ' · EXT' : ''}`;
                      return (
                        <motion.div
                          key={t.id}
                          whileHover={{ x: 3 }}
                          whileTap={{ scale: 0.97 }}
                          transition={SPRING_BOUNCY}
                          data-list-table={t.id}
                          onClick={() => onSelectTable(t.id, true)}
                          className={cn(
                            'group flex cursor-pointer items-center justify-between gap-2 rounded-2xl border border-transparent px-3 py-2 transition-colors hover:bg-secondary',
                            isSel && 'border-primary/25 bg-secondary shadow-[0_2px_10px_rgba(0,0,0,0.05)]',
                            isHidden && 'opacity-40'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold tracking-tight">{t.id}</div>
                            <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
                              {sub}
                            </div>
                          </div>
                          <button
                            className="bouncy-interactive inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                            title={isHidden ? 'Show table' : 'Hide table'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTableVisibility(t.id);
                            }}
                          >
                            {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )
              )}

              {activeTab === 'relations' && (
                filteredRelations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
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
                      <motion.div
                        key={r.id}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING_BOUNCY}
                        data-list-rel={r.id}
                        onClick={() => onSelectRelation(r.id, true)}
                        className={cn(
                          'cursor-pointer rounded-2xl border border-border bg-card p-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] transition-colors hover:border-input hover:bg-secondary/60',
                          selectedRelationId === r.id && 'border-primary bg-secondary shadow-[0_3px_12px_rgba(0,0,0,0.08)]'
                        )}
                      >
                        <div className="break-words font-mono text-[11px] font-semibold">
                          {r.sourceTableId}.{r.sourceColumns.join(',')} → {r.targetTableId}.{r.targetColumns.join(',')}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Badge variant="pk">{r.cardinality}</Badge>
                          {r.onDelete && <Badge variant="secondary">DEL: {r.onDelete}</Badge>}
                          {r.isSelfReference && <Badge variant="fk">SELF</Badge>}
                          {r.inferred && <Badge variant="warn">INFERRED</Badge>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )
              )}

              {activeTab === 'diagnostics' && (
                <div className="flex flex-col gap-2">
                  <div className="rounded-2xl border border-border bg-secondary/50 p-3 text-xs">
                    <div className="font-semibold">Parse Summary</div>
                    <div className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
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
                      <div className="px-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                        Enums ({schema.enums.length})
                      </div>
                      {schema.enums.map((en) => {
                        const label = en.schema ? `${en.schema}.${en.name}` : en.name;
                        return (
                          <div key={label} className="rounded-2xl border border-border bg-card p-2.5">
                            <div className="font-mono text-[11px] font-semibold">{label}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">{en.values.join(', ')}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {schema.warnings.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="px-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                        Notices ({schema.warnings.length})
                      </div>
                      {schema.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-dashed border-foreground/35 bg-secondary/60 p-2.5 text-[11.5px] text-foreground"
                        >
                          {w}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
