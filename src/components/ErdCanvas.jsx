import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Maximize2, LayoutGrid, Magnet, BookOpen, Upload, Code2 } from 'lucide-react';
import { renderErdSvg } from '@/renderer/svgRenderer.js';
import { ErdViewport } from '@/renderer/viewport.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const SPRING_BOUNCY = { type: 'spring', stiffness: 460, damping: 24, mass: 0.75 };

const ErdCanvas = forwardRef(function ErdCanvas(
  {
    schema,
    layout,
    theme,
    detailMode,
    edgeStyle,
    showEdgeLabels,
    selectedTableId,
    selectedRelationId,
    focusRootId,
    focusHops,
    onMoveTable,
    onSelectTable,
    onSelectRelation,
    onClearSelection,
    onFocusTable,
    onExitFocus,
    onRelayout,
    onOpenFile,
    onOpenEditor,
    children,
  },
  ref
) {
  const svgRef = useRef(null);
  const worldRef = useRef(null);
  const viewportRef = useRef(null);
  const minimapRef = useRef(null);

  const [hoveredTableId, setHoveredTableId] = useState(null);
  const [hoveredRelationId, setHoveredRelationId] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [vpState, setVpState] = useState({ tx: 0, ty: 0, scale: 1, viewportWidth: 1000, viewportHeight: 700 });
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const latestRef = useRef({});
  latestRef.current = {
    layout,
    onMoveTable,
    onSelectTable,
    onSelectRelation,
    onClearSelection,
    onFocusTable,
  };

  useEffect(() => {
    if (!svgRef.current || !worldRef.current) return;
    const vp = new ErdViewport(svgRef.current, worldRef.current, {
      getTablePosition: (id) => {
        const n = latestRef.current.layout?.nodes.get(id);
        return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
      },
      onMoveTable: (id, x, y) => latestRef.current.onMoveTable?.(id, x, y),
      onSelectTable: (id) => latestRef.current.onSelectTable?.(id, false),
      onSelectRelation: (id) => latestRef.current.onSelectRelation?.(id, false),
      onDoubleClickTable: (id) => latestRef.current.onFocusTable?.(id, 1),
      onCanvasClick: () => latestRef.current.onClearSelection?.(),
      onViewportChange: (nextVp) => setVpState(nextVp),
    });
    viewportRef.current = vp;
    return () => {
      viewportRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.snapToGrid = snapToGrid;
    }
  }, [snapToGrid]);

  useImperativeHandle(ref, () => ({
    fitBounds: (bounds, animated = true) => {
      if (bounds && viewportRef.current) {
        viewportRef.current.fitBounds(bounds, 52, animated);
      }
    },
    centerOnRect: (x, y, w, h) => viewportRef.current?.centerOnRect(x, y, w, h),
    zoomBy: (factor) => viewportRef.current?.zoomBy(factor),
    resetZoom: () => viewportRef.current?.resetZoom(),
    closeLegend: () => setLegendOpen(false),
  }));

  const svgMarkup =
    schema && layout
      ? renderErdSvg(schema, layout, {
          theme,
          detailMode,
          showTypes: true,
          showNullability: true,
          showEdgeLabels,
          edgeStyle,
          selectedTableId,
          hoveredTableId,
          selectedRelationId,
          hoveredRelationId,
          standalone: false,
        })
      : '';

  const handlePointerOver = (e) => {
    const tbl = e.target.closest?.('.erd-table');
    const edge = e.target.closest?.('.erd-edge');

    if (tbl) {
      setHoveredTableId(tbl.getAttribute('data-table-id'));
      setHoveredRelationId(null);
      setTooltip(null);
      return;
    }

    if (edge) {
      const relId = edge.getAttribute('data-relation-id');
      setHoveredRelationId(relId);
      setHoveredTableId(null);
      const rel = schema?.relations.find((r) => r.id === relId);
      if (rel) setTooltip({ x: e.clientX, y: e.clientY, rel });
      return;
    }

    if (hoveredTableId || hoveredRelationId) {
      setHoveredTableId(null);
      setHoveredRelationId(null);
      setTooltip(null);
    }
  };

  const handlePointerMove = (e) => {
    if (tooltip) {
      setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    }
  };

  const handlePointerLeave = () => {
    setHoveredTableId(null);
    setHoveredRelationId(null);
    setTooltip(null);
  };

  // Interactive Minimap Pan
  const minimapDragRef = useRef(false);
  const panFromMinimap = (e) => {
    if (!layout?.bounds || !minimapRef.current || !viewportRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const b = layout.bounds;
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    viewportRef.current.centerOnWorldPoint(b.minX + rx * b.width, b.minY + ry * b.height);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (minimapDragRef.current) panFromMinimap(e);
    };
    const onUp = () => {
      minimapDragRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  const bounds = layout?.bounds;
  const vpWorldX = -vpState.tx / vpState.scale;
  const vpWorldY = -vpState.ty / vpState.scale;
  const vpWorldW = vpState.viewportWidth / vpState.scale;
  const vpWorldH = vpState.viewportHeight / vpState.scale;
  const isDark = theme === 'dark';

  return (
    <main id="canvasStage" className="erd-canvas-surface relative flex-1 overflow-hidden">
      <svg
        ref={svgRef}
        id="erdSvg"
        className="erd-svg block h-full w-full"
        onPointerOver={handlePointerOver}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <g ref={worldRef} id="erdWorld" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
      </svg>

      {/* Springy Focus Mode Pill Banner */}
      <AnimatePresence>
        {focusRootId && (
          <motion.div
            id="focusBanner"
            initial={{ opacity: 0, y: -18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.92 }}
            transition={SPRING_BOUNCY}
            className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 py-1.5 pl-4 pr-2 shadow-[0_12px_32px_rgba(0,0,0,0.12)] backdrop-blur-md"
          >
            <span className="text-xs font-semibold tracking-tight">
              Focus: {focusRootId} ({layout?.nodes.size || 0} tables)
            </span>
            <Button
              variant={focusHops === 1 ? 'active' : 'outline'}
              size="sm"
              onClick={() => onFocusTable(focusRootId, 1)}
            >
              1-Hop
            </Button>
            <Button
              variant={focusHops === 2 ? 'active' : 'outline'}
              size="sm"
              onClick={() => onFocusTable(focusRootId, 2)}
            >
              2-Hop
            </Button>
            <Button variant="default" size="sm" onClick={onExitFocus}>
              Show All
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      <AnimatePresence>
        {(!schema || schema.tables.length === 0) && (
          <motion.div
            id="emptyState"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={SPRING_BOUNCY}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6"
          >
            <Card className="pointer-events-auto max-w-md border-dashed p-8 text-center">
              <h2 className="text-base font-bold tracking-tight">Drop your SQL file here</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Translate any MySQL, PostgreSQL (<code>pg_dump</code>), SQLite, SQL Server, or Oracle{' '}
                <code>.sql</code> file into a clean Entity-Relationship Diagram — 100% offline.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <Button variant="default" onClick={onOpenFile}>
                  <Upload />
                  Choose .sql File
                </Button>
                <Button variant="outline" onClick={onOpenEditor}>
                  <Code2 />
                  Paste SQL
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Airbnb-style Floating Capsule Zoom & Layout Dock */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_BOUNCY}
        className="absolute bottom-4 left-4 z-15 flex items-center gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-md dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
      >
        <Button
          id="btnZoomOut"
          variant="ghost"
          size="icon-sm"
          title="Zoom Out (-)"
          onClick={() => viewportRef.current?.zoomBy(1 / 1.22)}
        >
          <Minus />
        </Button>
        <span id="zoomReadout" className="min-w-11 text-center font-mono text-[11.5px] font-semibold text-foreground">
          {Math.round(vpState.scale * 100)}%
        </span>
        <Button
          id="btnZoomIn"
          variant="ghost"
          size="icon-sm"
          title="Zoom In (+)"
          onClick={() => viewportRef.current?.zoomBy(1.22)}
        >
          <Plus />
        </Button>
        <Separator orientation="vertical" className="mx-0.5 h-4" />
        <Button
          id="btnFit"
          variant="ghost"
          size="sm"
          title="Fit Entire Diagram (F)"
          onClick={() => bounds && viewportRef.current?.fitBounds(bounds, 52, true)}
        >
          <Maximize2 />
          Fit
        </Button>
        <Button
          id="btnRelayout"
          variant="ghost"
          size="sm"
          title="Reset Positions & Auto-Layout (L)"
          onClick={onRelayout}
        >
          <LayoutGrid />
          Auto-Layout
        </Button>
        <Button
          id="btnSnap"
          variant={snapToGrid ? 'active' : 'ghost'}
          size="sm"
          title="Snap Table Dragging to Grid"
          onClick={() => setSnapToGrid((s) => !s)}
        >
          <Magnet />
          Snap
        </Button>
        <Button
          id="btnLegend"
          variant={legendOpen ? 'active' : 'ghost'}
          size="sm"
          title="Crow's Foot Notation Legend"
          onClick={() => setLegendOpen((o) => !o)}
        >
          <BookOpen />
          Legend
        </Button>
      </motion.div>

      {/* Springy Crow's Foot Legend Popover */}
      <AnimatePresence>
        {legendOpen && (
          <motion.div
            id="legendPopover"
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={SPRING_BOUNCY}
            className="absolute bottom-16 left-4 z-25 w-64 rounded-2xl border border-border bg-card p-4 shadow-[0_14px_38px_rgba(0,0,0,0.12)] dark:shadow-[0_18px_42px_rgba(0,0,0,0.55)]"
          >
            <div className="mb-2.5 text-xs font-bold tracking-tight">Crow&apos;s Foot (IE) Notation</div>
            <div className="space-y-1.5 text-[11.5px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Mandatory One (1)</span>
                <span className="font-mono font-bold text-foreground">──||</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Optional One (0..1)</span>
                <span className="font-mono font-bold text-foreground">──o|</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Zero or Many (0..N)</span>
                <span className="font-mono font-bold text-foreground">──o&lt;</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Explicit Foreign Key</span>
                <span className="font-mono font-bold text-foreground">────</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Inferred Relation</span>
                <span className="font-mono font-bold text-muted-foreground">- - - -</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
              <Badge variant="pk">PK Primary</Badge>
              <Badge variant="fk">FK Foreign</Badge>
              <Badge variant="uk">UK Unique</Badge>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inspector Slot */}
      {children}

      {/* Minimalist Monochrome Minimap */}
      <motion.div
        ref={minimapRef}
        id="minimap"
        whileHover={{ scale: 1.03 }}
        transition={SPRING_BOUNCY}
        title="Click or drag to pan diagram"
        onPointerDown={(e) => {
          minimapDragRef.current = true;
          panFromMinimap(e);
        }}
        className="absolute bottom-4 right-4 z-15 h-32 w-48 cursor-crosshair overflow-hidden rounded-2xl border border-border bg-card/95 shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-md dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
      >
        {bounds && layout.nodes.size > 0 && (
          <svg
            className="block h-full w-full"
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          >
            {[...layout.nodes.values()].map((n) => {
              const isSel = n.id === selectedTableId;
              return (
                <rect
                  key={n.id}
                  x={n.x}
                  y={n.y}
                  width={n.width}
                  height={n.height}
                  rx="16"
                  fill={isSel ? (isDark ? '#fafafa' : '#111111') : isDark ? '#52525b' : '#b4b4b4'}
                  opacity={isSel ? 1 : 0.55}
                />
              );
            })}
            <rect
              x={vpWorldX}
              y={vpWorldY}
              width={vpWorldW}
              height={vpWorldH}
              fill={isDark ? 'rgba(250,250,250,0.07)' : 'rgba(17,17,17,0.05)'}
              stroke={isDark ? '#fafafa' : '#111111'}
              strokeWidth={Math.max(6, bounds.width * 0.008)}
            />
          </svg>
        )}
      </motion.div>

      {/* Edge Hover Tooltip */}
      {tooltip && (
        <div
          className="bouncy-popover pointer-events-none fixed z-50 max-w-xs rounded-2xl border border-border bg-popover px-3 py-2 text-[11.5px] text-popover-foreground shadow-[0_12px_30px_rgba(0,0,0,0.14)]"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <strong>
            {tooltip.rel.sourceTableId}.{tooltip.rel.sourceColumns.join(', ')}
          </strong>{' '}
          →{' '}
          <strong>
            {tooltip.rel.targetTableId}.{tooltip.rel.targetColumns.join(', ')}
          </strong>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {tooltip.rel.cardinality}
            {tooltip.rel.onDelete ? ` · ON DELETE ${tooltip.rel.onDelete}` : ''}
            {tooltip.rel.inferred ? ' · Inferred' : ''}
          </div>
        </div>
      )}
    </main>
  );
});

export default ErdCanvas;
