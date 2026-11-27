import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseSqlToSchema } from './parser/sqlParser.js';
import { computeErdLayout } from './layout/erdLayout.js';
import {
  exportSvg,
  exportPngBlob,
  exportMermaid,
  exportDbml,
  exportJson,
  exportMarkdownDocs,
} from './export/exporters.js';
import { SAMPLE_PRESETS } from './samples/presets.js';

import Topbar from './components/Topbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import SqlEditorDrawer from './components/SqlEditorDrawer.jsx';
import ErdCanvas from './components/ErdCanvas.jsx';
import Inspector from './components/Inspector.jsx';
import ExportModal from './components/ExportModal.jsx';
import DropOverlay from './components/DropOverlay.jsx';

const STORAGE_KEY = 'sql_to_erd_offline_prefs_v2';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(content, filename, mime = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([content], { type: mime }), filename);
}

export default function App() {
  const initialPrefs = useMemo(() => loadPrefs(), []);

  const [sql, setSql] = useState(SAMPLE_PRESETS.ecommerce_mysql.sql);
  const [debouncedSql, setDebouncedSql] = useState(SAMPLE_PRESETS.ecommerce_mysql.sql);
  const [fileName, setFileName] = useState('ecommerce_mysql.sql');

  const [theme, setTheme] = useState(initialPrefs.theme === 'dark' ? 'dark' : 'light');
  const [algorithm, setAlgorithm] = useState(initialPrefs.algorithm || 'hierarchical');
  const [detailMode, setDetailMode] = useState(initialPrefs.detailMode || 'full');
  const [edgeStyle, setEdgeStyle] = useState(initialPrefs.edgeStyle || 'orthogonal');
  const [inferRelations, setInferRelations] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(Boolean(initialPrefs.showEdgeLabels));

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tables');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSchemaFilter, setActiveSchemaFilter] = useState(null);
  const [hiddenTableIds, setHiddenTableIds] = useState(() => new Set());
  const [pinnedPositions, setPinnedPositions] = useState(() => new Map());

  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedRelationId, setSelectedRelationId] = useState(null);
  const [focusRootId, setFocusRootId] = useState(null);
  const [focusHops, setFocusHops] = useState(1);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [exportModalData, setExportModalData] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const editorRef = useRef(null);
  const toastTimerRef = useRef(null);
  const shouldFitRef = useRef(true);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setToastVisible(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2800);
  }, []);

  // Debounce live typing in SQL editor
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSql(sql), 200);
    return () => clearTimeout(t);
  }, [sql]);

  // Apply theme & persist prefs locally (sync both data-theme and .dark class for Tailwind/shadcn)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme, algorithm, detailMode, edgeStyle, showEdgeLabels })
      );
    } catch {}
  }, [theme, algorithm, detailMode, edgeStyle, showEdgeLabels]);

  // Parse SQL completely offline
  const schema = useMemo(
    () =>
      parseSqlToSchema(debouncedSql, {
        inferRelations,
        createExternalStubs: true,
      }),
    [debouncedSql, inferRelations]
  );

  // Compute visible tables (schema filter + hidden toggles + focus neighborhood)
  const visibleTableIds = useMemo(() => {
    let ids = new Set(schema.tables.map((t) => t.id));
    if (activeSchemaFilter) {
      ids = new Set(
        schema.tables
          .filter((t) => (t.schema || '(default)') === activeSchemaFilter)
          .map((t) => t.id)
      );
    }
    for (const hid of hiddenTableIds) ids.delete(hid);

    if (focusRootId && schema.tables.some((t) => t.id === focusRootId)) {
      const visited = new Set([focusRootId]);
      let frontier = new Set([focusRootId]);
      for (let h = 0; h < focusHops; h++) {
        const next = new Set();
        for (const r of schema.relations) {
          if (frontier.has(r.sourceTableId) && !visited.has(r.targetTableId)) {
            visited.add(r.targetTableId);
            next.add(r.targetTableId);
          }
          if (frontier.has(r.targetTableId) && !visited.has(r.sourceTableId)) {
            visited.add(r.sourceTableId);
            next.add(r.sourceTableId);
          }
        }
        frontier = next;
      }
      ids = new Set([...ids].filter((id) => visited.has(id)));
      ids.add(focusRootId);
    }
    return ids;
  }, [schema, activeSchemaFilter, hiddenTableIds, focusRootId, focusHops]);

  // Compute ERD layout
  const layout = useMemo(
    () =>
      computeErdLayout(schema, {
        algorithm,
        detailMode,
        showTypes: true,
        visibleTableIds,
        pinnedPositions,
      }),
    [schema, algorithm, detailMode, visibleTableIds, pinnedPositions]
  );

  // Auto-fit when a new schema / layout / focus mode is activated
  useEffect(() => {
    if (shouldFitRef.current && layout.nodes.size > 0) {
      shouldFitRef.current = false;
      requestAnimationFrame(() => canvasRef.current?.fitBounds(layout.bounds));
    }
  }, [layout]);

  const loadSql = useCallback((sqlText, name = 'schema.sql', resetView = true) => {
    setSql(sqlText);
    setDebouncedSql(sqlText);
    setFileName(name);
    if (resetView) {
      setPinnedPositions(new Map());
      setHiddenTableIds(new Set());
      setActiveSchemaFilter(null);
      setFocusRootId(null);
      setSelectedTableId(null);
      setSelectedRelationId(null);
    }
    shouldFitRef.current = true;
  }, []);

  const handleUploadedFile = useCallback(
    async (file) => {
      try {
        const text = await file.text();
        if (file.name.endsWith('.erd.json')) {
          const saved = JSON.parse(text);
          if (typeof saved.sql === 'string') {
            setPinnedPositions(new Map(Object.entries(saved.positions || {})));
            if (saved.algorithm) setAlgorithm(saved.algorithm);
            if (saved.detailMode) setDetailMode(saved.detailMode);
            if (typeof saved.inferRelations === 'boolean') setInferRelations(saved.inferRelations);
            loadSql(saved.sql, saved.fileName || file.name, false);
            showToast(`Restored workspace: ${file.name}`);
            return;
          }
        }
        loadSql(text, file.name, true);
        const parsed = parseSqlToSchema(text, { inferRelations });
        const st = parsed.stats;
        if (st.tableCount > 0 && st.explicitRelationCount === 0 && !inferRelations) {
          showToast(`Loaded ${st.tableCount} tables (no explicit FKs found — try "Infer FKs"!)`);
        } else {
          showToast(`Loaded ${file.name}: ${st.tableCount} tables, ${st.relationCount} relations`);
        }
      } catch (err) {
        showToast(`Failed to read file: ${err.message}`);
      }
    },
    [inferRelations, loadSql, showToast]
  );

  // Window drag-and-drop for .sql / .erd.json files
  useEffect(() => {
    let dragCounter = 0;
    const onEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      setIsDraggingFile(true);
    };
    const onOver = (e) => e.preventDefault();
    const onLeave = () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) setIsDraggingFile(false);
    };
    const onDrop = (e) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDraggingFile(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleUploadedFile(file);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleUploadedFile]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const inInput = tag === 'textarea' || tag === 'input' || tag === 'select';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSidebarOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 10);
        return;
      }
      if (e.key === 'Escape') {
        setExportModalData(null);
        canvasRef.current?.closeLegend();
        if (focusRootId) {
          setFocusRootId(null);
          setPinnedPositions(new Map());
          shouldFitRef.current = true;
        } else {
          setSelectedTableId(null);
          setSelectedRelationId(null);
        }
        return;
      }
      if (inInput) return;

      if (e.key === 'f' || e.key === 'F') canvasRef.current?.fitBounds(layout.bounds);
      else if (e.key === 'l' || e.key === 'L') {
        setPinnedPositions(new Map());
        shouldFitRef.current = true;
      } else if (e.key === 'e' || e.key === 'E') {
        setEditorOpen((o) => !o);
      } else if (e.key === '+' || e.key === '=') {
        canvasRef.current?.zoomBy(1.18);
      } else if (e.key === '-') {
        canvasRef.current?.zoomBy(1 / 1.18);
      } else if (e.key === '0') {
        canvasRef.current?.resetZoom();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusRootId, layout.bounds]);

  const handleSelectTable = useCallback(
    (tableId, center = false) => {
      setHiddenTableIds((prev) => {
        if (!prev.has(tableId)) return prev;
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
      setSelectedTableId(tableId);
      setSelectedRelationId(null);
      if (center) {
        const n = layout.nodes.get(tableId);
        if (n) canvasRef.current?.centerOnRect(n.x, n.y, n.width, n.height);
      }
    },
    [layout]
  );

  const handleSelectRelation = useCallback(
    (relId, center = false) => {
      setSelectedRelationId(relId);
      setSelectedTableId(null);
      if (center) {
        const rel = schema.relations.find((r) => r.id === relId);
        const src = rel && layout.nodes.get(rel.sourceTableId);
        const tgt = rel && layout.nodes.get(rel.targetTableId);
        if (src && tgt) {
          const minX = Math.min(src.x, tgt.x);
          const minY = Math.min(src.y, tgt.y);
          const maxX = Math.max(src.x + src.width, tgt.x + tgt.width);
          const maxY = Math.max(src.y + src.height, tgt.y + tgt.height);
          canvasRef.current?.centerOnRect(minX, minY, maxX - minX, maxY - minY);
        }
      }
    },
    [schema, layout]
  );

  const handleMoveTable = useCallback((id, x, y) => {
    setPinnedPositions((prev) => {
      const next = new Map(prev);
      next.set(id, { x, y });
      return next;
    });
  }, []);

  const handleExport = useCallback(
    async (type) => {
      const baseName = (fileName || 'erd').replace(/\.(sql|ddl|txt|erd\.json)$/i, '');

      if (type === 'svg') {
        const svg = exportSvg(schema, layout, {
          theme,
          detailMode,
          edgeStyle,
          showEdgeLabels,
          includeGrid: true,
        });
        downloadText(svg, `${baseName}-erd.svg`, 'image/svg+xml;charset=utf-8');
        showToast(`Exported ${baseName}-erd.svg`);
        return;
      }

      if (type === 'png') {
        try {
          const svg = exportSvg(schema, layout, {
            theme,
            detailMode,
            edgeStyle,
            showEdgeLabels,
            includeGrid: true,
          });
          const blob = await exportPngBlob(svg, 2);
          downloadBlob(blob, `${baseName}-erd.png`);
          showToast(`Exported ${baseName}-erd.png (2x HD)`);
        } catch (err) {
          showToast(`PNG export failed: ${err.message}`);
        }
        return;
      }

      if (type === 'workspace') {
        const payload = JSON.stringify(
          {
            version: 1,
            fileName,
            sql,
            algorithm,
            detailMode,
            inferRelations,
            positions: Object.fromEntries(pinnedPositions.entries()),
          },
          null,
          2
        );
        downloadText(payload, `${baseName}.erd.json`, 'application/json');
        showToast(`Saved workspace ${baseName}.erd.json`);
        return;
      }

      const map = {
        mermaid: {
          title: 'Mermaid ERD Export',
          filename: `${baseName}-erd.mmd`,
          mime: 'text/plain;charset=utf-8',
          content: exportMermaid(schema),
        },
        dbml: {
          title: 'DBML Schema Export',
          filename: `${baseName}.dbml`,
          mime: 'text/plain;charset=utf-8',
          content: exportDbml(schema),
        },
        markdown: {
          title: 'Markdown Data Dictionary',
          filename: `${baseName}-docs.md`,
          mime: 'text/markdown;charset=utf-8',
          content: exportMarkdownDocs(schema),
        },
        json: {
          title: 'JSON Schema Export',
          filename: `${baseName}-schema.json`,
          mime: 'application/json',
          content: exportJson(schema, layout),
        },
      };

      if (map[type]) setExportModalData(map[type]);
    },
    [schema, layout, fileName, theme, detailMode, edgeStyle, showEdgeLabels, sql, algorithm, inferRelations, pinnedPositions, showToast]
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <input
        ref={fileInputRef}
        type="file"
        id="sqlFileInput"
        accept=".sql,.ddl,.txt,.erd.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadedFile(file);
          e.target.value = '';
        }}
      />

      <Topbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onOpenFile={() => fileInputRef.current?.click()}
        onSelectSample={(key, sample) => {
          loadSql(sample.sql, `${key}.sql`, true);
          showToast(`Loaded sample: ${sample.name}`);
        }}
        editorOpen={editorOpen}
        onToggleEditor={() => {
          setEditorOpen((o) => !o);
          setTimeout(() => editorRef.current?.focus(), 20);
        }}
        algorithm={algorithm}
        onChangeAlgorithm={(val) => {
          setAlgorithm(val);
          setPinnedPositions(new Map());
          shouldFitRef.current = true;
        }}
        detailMode={detailMode}
        onChangeDetailMode={setDetailMode}
        edgeStyle={edgeStyle}
        onToggleEdgeStyle={() => setEdgeStyle((s) => (s === 'orthogonal' ? 'curved' : 'orthogonal'))}
        inferRelations={inferRelations}
        onToggleInferRelations={() => {
          const next = !inferRelations;
          setInferRelations(next);
          const preview = parseSqlToSchema(debouncedSql, { inferRelations: next });
          showToast(
            next
              ? `Implicit relation inference ON (${preview.inferredRelationCount} inferred)`
              : 'Implicit relation inference OFF'
          );
        }}
        showEdgeLabels={showEdgeLabels}
        onToggleEdgeLabels={() => setShowEdgeLabels((v) => !v)}
        onExport={handleExport}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <div className="relative flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          schema={schema}
          fileName={fileName}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
          activeSchemaFilter={activeSchemaFilter}
          onSelectSchemaFilter={(s) => {
            setActiveSchemaFilter(s);
            shouldFitRef.current = true;
          }}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          hiddenTableIds={hiddenTableIds}
          onToggleTableVisibility={(id) => {
            setHiddenTableIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          selectedTableId={selectedTableId}
          onSelectTable={handleSelectTable}
          selectedRelationId={selectedRelationId}
          onSelectRelation={handleSelectRelation}
        />

        <SqlEditorDrawer
          open={editorOpen}
          fileName={fileName}
          sql={sql}
          onChangeSql={setSql}
          onClear={() => loadSql('', 'untitled.sql', true)}
          onClose={() => setEditorOpen(false)}
          editorRef={editorRef}
        />

        <ErdCanvas
          ref={canvasRef}
          schema={schema}
          layout={layout}
          theme={theme}
          detailMode={detailMode}
          edgeStyle={edgeStyle}
          showEdgeLabels={showEdgeLabels}
          selectedTableId={selectedTableId}
          selectedRelationId={selectedRelationId}
          focusRootId={focusRootId}
          focusHops={focusHops}
          onMoveTable={handleMoveTable}
          onSelectTable={handleSelectTable}
          onSelectRelation={handleSelectRelation}
          onClearSelection={() => {
            setSelectedTableId(null);
            setSelectedRelationId(null);
          }}
          onFocusTable={(id, hops) => {
            setFocusRootId(id);
            setFocusHops(hops);
            setSelectedTableId(id);
            setPinnedPositions(new Map());
            shouldFitRef.current = true;
          }}
          onExitFocus={() => {
            setFocusRootId(null);
            setPinnedPositions(new Map());
            shouldFitRef.current = true;
          }}
          onRelayout={() => {
            setPinnedPositions(new Map());
            shouldFitRef.current = true;
            showToast('Auto-layout applied');
          }}
          onOpenFile={() => fileInputRef.current?.click()}
          onOpenEditor={() => {
            setEditorOpen(true);
            setTimeout(() => editorRef.current?.focus(), 20);
          }}
        >
          <Inspector
            schema={schema}
            selectedTableId={selectedTableId}
            selectedRelationId={selectedRelationId}
            onClose={() => {
              setSelectedTableId(null);
              setSelectedRelationId(null);
            }}
            onSelectTable={handleSelectTable}
            onFocusTable={(id, hops) => {
              setFocusRootId(id);
              setFocusHops(hops);
              setSelectedTableId(id);
              setPinnedPositions(new Map());
              shouldFitRef.current = true;
            }}
            onHideTable={(id) => {
              setHiddenTableIds((prev) => new Set(prev).add(id));
              setSelectedTableId(null);
            }}
          />
        </ErdCanvas>
      </div>

      <DropOverlay visible={isDraggingFile} />

      <ExportModal
        exportData={exportModalData}
        onClose={() => setExportModalData(null)}
        onCopy={async () => {
          if (!exportModalData) return;
          try {
            await navigator.clipboard.writeText(exportModalData.content);
            showToast('Copied to clipboard');
          } catch {
            showToast('Copy failed — please select and copy manually');
          }
        }}
        onDownload={() => {
          if (!exportModalData) return;
          downloadText(exportModalData.content, exportModalData.filename, exportModalData.mime);
          showToast(`Downloaded ${exportModalData.filename}`);
        }}
      />

      <AnimatePresence>
        {toastVisible && (
          <motion.div
            id="toast"
            key={toastMsg}
            initial={{ opacity: 0, y: -24, scale: 0.86 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24, mass: 0.7 }}
            className="pointer-events-none fixed left-1/2 top-18 z-50 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_12px_32px_rgba(0,0,0,0.22)]"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
