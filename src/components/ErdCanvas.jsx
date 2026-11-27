import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Minus, Plus, Maximize2, LayoutGrid, Magnet, BookOpen, Upload, Code2 } from 'lucide-react';
import { renderErdSvg } from '@/renderer/svgRenderer.js';
import { ErdViewport } from '@/renderer/viewport.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
    fitBounds: (bounds) => {
      if (bounds && viewportRef.current) {
        viewportRef.current.fitBounds(bounds, 48);
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

      {/* Focus Mode Banner */}
      {focusRootId && (
        <div
          id="focusBanner"
          className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary bg-card py-1 pl-3.5 pr-2 shadow-xl"
        >
          <span className="text-xs font-semibold">
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
        </div>
      )}

      {/* Empty State */}
      {(!schema || schema.tables.length === 0) && (
        <div
          id="emptyState"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6"
        >
          <Card className="pointer-events-auto max-w-md border-dashed p-7 text-center">
            <h2 className="text-base font-bold">Drop your SQL file here</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Translate any MySQL, PostgreSQL (<code>pg_dump</code>), SQLite, SQL Server, or Oracle{' '}
              <code>.sql</code> file into a full Entity-Relationship Diagram — 100% offline.
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
        </div>
      )}

      {/* Floating Bottom-Left Zoom & Layout Controls */}
      <div className="absolute bottom-3.5 left-3.5 z-15 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-md">
        <Button
          id="btnZoomOut"
          variant="ghost"
          size="icon-sm"
          title="Zoom Out (-)"
          onClick={() => viewportRef.current?.zoomBy(1 / 1.2)}
        >
          <Minus />
        </Button>
        <span id="zoomReadout" className="min-w-11 text-center font-mono text-[11.5px] font-semibold text-muted-foreground">
          {Math.round(vpState.scale * 100)}%
        </span>
        <Button
          id="btnZoomIn"
          variant="ghost"
          size="icon-sm"
          title="Zoom In (+)"
          onClick={() => viewportRef.current?.zoomBy(1.2)}
        >
          <Plus />
        </Button>
        <Separator orientation="vertical" className="mx-0.5 h-4" />
        <Button
          id="btnFit"
          variant="ghost"
          size="sm"
          title="Fit Entire Diagram (F)"
          onClick={() => bounds && viewportRef.current?.fitBounds(bounds, 48)}
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
      </div>

      {/* Crow's Foot Legend Popover */}
      {legendOpen && (
        <Card id="legendPopover" className="absolute bottom-14 left-3.5 z-25 w-64 p-3">
          <div className="mb-2 text-xs font-bold">Crow&apos;s Foot (IE) Notation</div>
          <div className="space-y-1 text-[11.5px] text-muted-foreground">
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
              <span className="font-mono font-bold text-amber-500">- - - -</span>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2">
            <Badge variant="pk">PK Primary</Badge>
            <Badge variant="fk">FK Foreign</Badge>
            <Badge variant="uk">UK Unique</Badge>
          </div>
        </Card>
      )}

      {/* Inspector Slot */}
      {children}

      {/* Interactive Minimap */}
      <div
        ref={minimapRef}
        id="minimap"
        title="Click or drag to pan diagram"
        onPointerDown={(e) => {
          minimapDragRef.current = true;
          panFromMinimap(e);
        }}
        className="absolute bottom-3.5 right-3.5 z-15 h-32 w-48 cursor-crosshair overflow-hidden rounded-lg border border-border bg-card shadow-md"
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
                  rx="12"
                  fill={isSel ? '#3b82f6' : '#64748b'}
                  opacity={isSel ? 0.95 : 0.45}
                />
              );
            })}
            <rect
              x={vpWorldX}
              y={vpWorldY}
              width={vpWorldW}
              height={vpWorldH}
              fill="rgba(59,130,246,0.12)"
              stroke="#3b82f6"
              strokeWidth={Math.max(6, bounds.width * 0.008)}
            />
          </svg>
        )}
      </div>

      {/* Edge Hover Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11.5px] text-popover-foreground shadow-xl"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <strong>
            {tooltip.rel.sourceTableId}.{tooltip.rel.sourceColumns.join(', ')}
          </strong>{' '}
          →{' '}
          <strong>
            {tooltip.rel.targetTableId}.{tooltip.rel.targetColumns.join(', ')}
          </strong>
          <div className="text-[11px] text-muted-foreground">
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
