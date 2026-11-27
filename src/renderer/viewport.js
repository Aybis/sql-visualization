/**
 * Interactive SVG Viewport Controller
 * Handles smooth pan, cursor-centered wheel zoom, table dragging with live edge redraw,
 * snap-to-grid, fit-to-screen, zoom-to-target, and interactive minimap synchronization.
 */

export class ErdViewport {
  constructor(svgEl, worldGroupEl, callbacks = {}) {
    this.svg = svgEl;
    this.world = worldGroupEl;
    this.callbacks = callbacks;

    this.tx = 0;
    this.ty = 0;
    this.scale = 1;
    this.minScale = 0.12;
    this.maxScale = 2.6;
    this.snapToGrid = false;
    this.gridSize = 20;

    this._panning = false;
    this._draggingTableId = null;
    this._dragStartClient = null;
    this._dragStartWorld = null;
    this._dragMoved = false;

    this._bindEvents();
  }

  _bindEvents() {
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Support trackpad pinch (ctrlKey) and regular wheel smoothly
      const factor = e.ctrlKey
        ? Math.exp(-e.deltaY * 0.01)
        : e.deltaY < 0
          ? 1.11
          : 1 / 1.11;

      this.zoomAt(mouseX, mouseY, this.scale * factor);
    }, { passive: false });

    this.svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;

      const tableEl = e.target.closest?.('.erd-table');
      const edgeEl = e.target.closest?.('.erd-edge');

      if (tableEl && e.button === 0) {
        const tableId = tableEl.getAttribute('data-table-id');
        this._draggingTableId = tableId;
        this._dragStartClient = { x: e.clientX, y: e.clientY };
        const curPos = this.callbacks.getTablePosition?.(tableId) || { x: 0, y: 0 };
        this._dragStartWorld = { x: curPos.x, y: curPos.y };
        this._dragMoved = false;
        this.svg.setPointerCapture?.(e.pointerId);
        this.svg.classList.add('is-dragging-node');
        return;
      }

      if (edgeEl && e.button === 0) {
        const relId = edgeEl.getAttribute('data-relation-id');
        this.callbacks.onSelectRelation?.(relId);
        return;
      }

      // Pan canvas
      this._panning = true;
      this._dragMoved = false;
      this._dragStartClient = { x: e.clientX, y: e.clientY };
      this._dragStartWorld = { x: this.tx, y: this.ty };
      this.svg.setPointerCapture?.(e.pointerId);
      this.svg.classList.add('is-panning');
    });

    this.svg.addEventListener('pointermove', (e) => {
      if (this._draggingTableId) {
        const dx = (e.clientX - this._dragStartClient.x) / this.scale;
        const dy = (e.clientY - this._dragStartClient.y) / this.scale;
        if (Math.hypot(e.clientX - this._dragStartClient.x, e.clientY - this._dragStartClient.y) > 3) {
          this._dragMoved = true;
        }
        let nx = this._dragStartWorld.x + dx;
        let ny = this._dragStartWorld.y + dy;
        if (this.snapToGrid) {
          nx = Math.round(nx / this.gridSize) * this.gridSize;
          ny = Math.round(ny / this.gridSize) * this.gridSize;
        }
        this.callbacks.onMoveTable?.(this._draggingTableId, Math.round(nx), Math.round(ny));
        return;
      }

      if (this._panning) {
        const dx = e.clientX - this._dragStartClient.x;
        const dy = e.clientY - this._dragStartClient.y;
        if (Math.hypot(dx, dy) > 3) this._dragMoved = true;
        this.tx = this._dragStartWorld.x + dx;
        this.ty = this._dragStartWorld.y + dy;
        this.applyTransform();
      }
    });

    const endInteraction = (e) => {
      if (this._draggingTableId) {
        const id = this._draggingTableId;
        const moved = this._dragMoved;
        this._draggingTableId = null;
        this.svg.classList.remove('is-dragging-node');
        try { this.svg.releasePointerCapture?.(e.pointerId); } catch {}
        if (!moved) {
          this.callbacks.onSelectTable?.(id);
        } else {
          this.callbacks.onMoveTableEnd?.(id);
        }
      }
      if (this._panning) {
        const moved = this._dragMoved;
        this._panning = false;
        this.svg.classList.remove('is-panning');
        try { this.svg.releasePointerCapture?.(e.pointerId); } catch {}
        if (!moved) {
          this.callbacks.onCanvasClick?.();
        }
      }
    };

    this.svg.addEventListener('pointerup', endInteraction);
    this.svg.addEventListener('pointercancel', endInteraction);

    this.svg.addEventListener('dblclick', (e) => {
      const tableEl = e.target.closest?.('.erd-table');
      if (tableEl) {
        this.callbacks.onDoubleClickTable?.(tableEl.getAttribute('data-table-id'));
      }
    });
  }

  applyTransform() {
    this.world.setAttribute('transform', `translate(${this.tx.toFixed(2)}, ${this.ty.toFixed(2)}) scale(${this.scale.toFixed(4)})`);
    this.callbacks.onViewportChange?.(this.getState());
  }

  getState() {
    const rect = this.svg.getBoundingClientRect();
    return {
      tx: this.tx,
      ty: this.ty,
      scale: this.scale,
      viewportWidth: rect.width || 1000,
      viewportHeight: rect.height || 700,
    };
  }

  zoomAt(screenX, screenY, nextScale) {
    const clamped = Math.max(this.minScale, Math.min(this.maxScale, nextScale));
    const ratio = clamped / this.scale;
    this.tx = screenX - (screenX - this.tx) * ratio;
    this.ty = screenY - (screenY - this.ty) * ratio;
    this.scale = clamped;
    this.applyTransform();
  }

  zoomBy(factor) {
    const rect = this.svg.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, this.scale * factor);
  }

  resetZoom() {
    const rect = this.svg.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 1);
  }

  fitBounds(bounds, margin = 48) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const rect = this.svg.getBoundingClientRect();
    const vw = Math.max(200, rect.width);
    const vh = Math.max(200, rect.height);
    const availW = Math.max(100, vw - margin * 2);
    const availH = Math.max(100, vh - margin * 2);
    const s = Math.min(1.15, Math.max(this.minScale, Math.min(availW / bounds.width, availH / bounds.height)));
    const cx = bounds.minX + bounds.width / 2;
    const cy = bounds.minY + bounds.height / 2;
    this.scale = s;
    this.tx = vw / 2 - cx * s;
    this.ty = vh / 2 - cy * s;
    this.applyTransform();
  }

  centerOnRect(x, y, width, height, targetScale = null) {
    const rect = this.svg.getBoundingClientRect();
    const vw = rect.width || 1000;
    const vh = rect.height || 700;
    const s = targetScale ? Math.max(this.minScale, Math.min(this.maxScale, targetScale)) : Math.max(0.75, Math.min(1.15, this.scale));
    this.scale = s;
    this.tx = vw / 2 - (x + width / 2) * s;
    this.ty = vh / 2 - (y + height / 2) * s;
    this.applyTransform();
  }

  centerOnWorldPoint(wx, wy) {
    const rect = this.svg.getBoundingClientRect();
    this.tx = rect.width / 2 - wx * this.scale;
    this.ty = rect.height / 2 - wy * this.scale;
    this.applyTransform();
  }
}
