/**
 * Main Interactive Application Controller for Offline SQL-to-ERD Studio
 */

import { parseSqlToSchema } from '../parser/sqlParser.js';
import { computeErdLayout } from '../layout/erdLayout.js';
import { renderErdSvg, escapeXml } from '../renderer/svgRenderer.js';
import { ErdViewport } from '../renderer/viewport.js';
import {
  exportSvg,
  exportPngBlob,
  exportMermaid,
  exportDbml,
  exportJson,
  exportMarkdownDocs,
} from '../export/exporters.js';
import { SAMPLE_PRESETS } from '../samples/presets.js';

const STORAGE_KEY = 'sql_to_erd_offline_prefs_v1';

class SqlToErdApp {
  constructor() {
    this.state = {
      sql: '',
      fileName: 'ecommerce_mysql.sql',
      schema: null,
      layout: null,
      theme: 'dark',
      algorithm: 'hierarchical',
      detailMode: 'full',
      edgeStyle: 'orthogonal',
      inferRelations: false,
      showEdgeLabels: false,
      activeTab: 'tables',
      searchQuery: '',
      activeSchemaFilter: null,
      hiddenTableIds: new Set(),
      pinnedPositions: new Map(),
      selectedTableId: null,
      hoveredTableId: null,
      selectedRelationId: null,
      hoveredRelationId: null,
      focusRootId: null,
      focusHops: 1,
    };

    this._modalExport = null;
    this._parseTimer = null;
    this._toastTimer = null;

    this._loadPrefs();
    this._cacheDom();
    this._initViewport();
    this._buildSamplesMenu();
    this._bindEvents();

    // Apply initial theme and load default sample
    this._applyTheme(this.state.theme);
    this._syncControlStates();
    this.loadSql(SAMPLE_PRESETS.ecommerce_mysql.sql, 'ecommerce_mysql.sql', true);
  }

  _loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (prefs.theme === 'light' || prefs.theme === 'dark') this.state.theme = prefs.theme;
      if (prefs.algorithm) this.state.algorithm = prefs.algorithm;
      if (prefs.detailMode) this.state.detailMode = prefs.detailMode;
      if (prefs.edgeStyle) this.state.edgeStyle = prefs.edgeStyle;
      if (typeof prefs.showEdgeLabels === 'boolean') this.state.showEdgeLabels = prefs.showEdgeLabels;
    } catch {}
  }

  _savePrefs() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          theme: this.state.theme,
          algorithm: this.state.algorithm,
          detailMode: this.state.detailMode,
          edgeStyle: this.state.edgeStyle,
          showEdgeLabels: this.state.showEdgeLabels,
        })
      );
    } catch {}
  }

  _cacheDom() {
    const $ = (id) => document.getElementById(id);
    this.dom = {
      sidebar: $('sidebar'),
      sqlDrawer: $('sqlDrawer'),
      sqlEditor: $('sqlEditor'),
      editorTitle: $('editorTitle'),
      editorStats: $('editorStats'),
      erdSvg: $('erdSvg'),
      erdWorld: $('erdWorld'),
      canvasStage: $('canvasStage'),
      statTables: $('statTables'),
      statRelations: $('statRelations'),
      statColumns: $('statColumns'),
      fileNameLabel: $('fileNameLabel'),
      dialectBadge: $('dialectBadge'),
      searchInput: $('searchInput'),
      schemaChips: $('schemaChips'),
      sidebarList: $('sidebarList'),
      tabDiagnostics: $('tabDiagnostics'),
      emptyState: $('emptyState'),
      dropOverlay: $('dropOverlay'),
      focusBanner: $('focusBanner'),
      focusBannerText: $('focusBannerText'),
      zoomReadout: $('zoomReadout'),
      legendPopover: $('legendPopover'),
      inspector: $('inspector'),
      inspectorTitle: $('inspectorTitle'),
      inspectorSub: $('inspectorSub'),
      inspectorBody: $('inspectorBody'),
      minimap: $('minimap'),
      minimapSvg: $('minimapSvg'),
      exportModal: $('exportModal'),
      modalTitle: $('modalTitle'),
      modalCode: $('modalCode'),
      hoverTooltip: $('hoverTooltip'),
      toast: $('toast'),
      sqlFileInput: $('sqlFileInput'),
      samplesDropdown: $('samplesDropdown'),
      samplesMenu: $('samplesMenu'),
      exportDropdown: $('exportDropdown'),
      selectLayout: $('selectLayout'),
      selectDetail: $('selectDetail'),
      btnEdgeStyle: $('btnEdgeStyle'),
      btnInferFks: $('btnInferFks'),
      btnEdgeLabels: $('btnEdgeLabels'),
      btnToggleEditor: $('btnToggleEditor'),
      btnSnap: $('btnSnap'),
      btnLegend: $('btnLegend'),
      btnFocus1Hop: $('btnFocus1Hop'),
      btnFocus2Hop: $('btnFocus2Hop'),
      iconSun: $('iconSun'),
      iconMoon: $('iconMoon'),
    };
  }

  _initViewport() {
    this.viewport = new ErdViewport(this.dom.erdSvg, this.dom.erdWorld, {
      getTablePosition: (id) => {
        const n = this.state.layout?.nodes.get(id);
        return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
      },
      onMoveTable: (id, x, y) => {
        this.state.pinnedPositions.set(id, { x, y });
        const node = this.state.layout?.nodes.get(id);
        if (node) {
          node.x = x;
          node.y = y;
          this._renderCanvasOnly();
          this._renderMinimap();
        }
      },
      onMoveTableEnd: () => {
        this._recomputeBounds();
        this._renderMinimap();
      },
      onSelectTable: (id) => {
        this.selectTable(id);
      },
      onSelectRelation: (id) => {
        this.selectRelation(id);
      },
      onDoubleClickTable: (id) => {
        this.enterFocusMode(id, 1);
      },
      onCanvasClick: () => {
        this.clearSelection();
      },
      onViewportChange: (vp) => {
        this.dom.zoomReadout.textContent = `${Math.round(vp.scale * 100)}%`;
        this._renderMinimap();
      },
    });
  }

  _buildSamplesMenu() {
    const entries = Object.entries(SAMPLE_PRESETS);
    this.dom.samplesMenu.innerHTML = entries
      .map(
        ([key, sample]) =>
          `<button class="dropdown-item" data-sample="${escapeXml(key)}"><span>${escapeXml(sample.name)}</span><small>${escapeXml(sample.dialect)}</small></button>`
      )
      .join('');

    this.dom.samplesMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sample]');
      if (!btn) return;
      const key = btn.getAttribute('data-sample');
      const preset = SAMPLE_PRESETS[key];
      if (preset) {
        this.dom.samplesDropdown.classList.remove('is-open');
        this.loadSql(preset.sql, `${key}.sql`, true);
        this.showToast(`Loaded sample: ${preset.name}`);
      }
    });
  }

  _syncControlStates() {
    this.dom.selectLayout.value = this.state.algorithm;
    this.dom.selectDetail.value = this.state.detailMode;
    this.dom.btnEdgeStyle.textContent = this.state.edgeStyle === 'orthogonal' ? 'Orthogonal' : 'Curved';
    this.dom.btnInferFks.classList.toggle('is-active', this.state.inferRelations);
    this.dom.btnEdgeLabels.classList.toggle('is-active', this.state.showEdgeLabels);
  }

  _applyTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.dom.iconSun.style.display = theme === 'dark' ? 'block' : 'none';
    this.dom.iconMoon.style.display = theme === 'light' ? 'block' : 'none';
    this._savePrefs();
    if (this.state.schema) {
      this._renderCanvasOnly();
      this._renderMinimap();
    }
  }

  _bindEvents() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    // Sidebar toggle
    on('btnToggleSidebar', 'click', () => {
      this.dom.sidebar.classList.toggle('is-collapsed');
      setTimeout(() => this._renderMinimap(), 50);
    });

    // File Upload
    on('btnOpenFile', 'click', () => this.dom.sqlFileInput.click());
    on('btnEmptyUpload', 'click', () => this.dom.sqlFileInput.click());
    this.dom.sqlFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this._handleUploadedFile(file);
      e.target.value = '';
    });

    // SQL Editor Drawer
    const toggleEditor = () => {
      this.dom.sqlDrawer.classList.toggle('is-collapsed');
      const open = !this.dom.sqlDrawer.classList.contains('is-collapsed');
      this.dom.btnToggleEditor.classList.toggle('is-active', open);
      if (open) this.dom.sqlEditor.focus();
    };
    on('btnToggleEditor', 'click', toggleEditor);
    on('btnCloseEditor', 'click', toggleEditor);
    on('btnEmptyEditor', 'click', () => {
      this.dom.sqlDrawer.classList.remove('is-collapsed');
      this.dom.btnToggleEditor.classList.add('is-active');
      this.dom.sqlEditor.focus();
    });
    on('btnClearSql', 'click', () => {
      this.loadSql('', 'untitled.sql', true);
    });

    this.dom.sqlEditor.addEventListener('input', () => {
      const val = this.dom.sqlEditor.value;
      this.state.sql = val;
      this._updateEditorLineCount(val);
      clearTimeout(this._parseTimer);
      this._parseTimer = setTimeout(() => {
        this._parseAndRender(false);
      }, 240);
    });

    // Dropdown toggles
    const setupDropdown = (dropEl, btnId) => {
      on(btnId, 'click', (e) => {
        e.stopPropagation();
        const wasOpen = dropEl.classList.contains('is-open');
        document.querySelectorAll('.dropdown.is-open').forEach((d) => d.classList.remove('is-open'));
        if (!wasOpen) dropEl.classList.add('is-open');
      });
    };
    setupDropdown(this.dom.samplesDropdown, 'btnSamples');
    setupDropdown(this.dom.exportDropdown, 'btnExport');
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown.is-open').forEach((d) => d.classList.remove('is-open'));
    });

    // Layout / Detail / Edge Style / Infer / Labels
    this.dom.selectLayout.addEventListener('change', (e) => {
      this.state.algorithm = e.target.value;
      this.state.pinnedPositions.clear();
      this._savePrefs();
      this._recomputeLayoutAndRender(true);
    });

    this.dom.selectDetail.addEventListener('change', (e) => {
      this.state.detailMode = e.target.value;
      this._savePrefs();
      this._recomputeLayoutAndRender(false);
    });

    on('btnEdgeStyle', 'click', () => {
      this.state.edgeStyle = this.state.edgeStyle === 'orthogonal' ? 'curved' : 'orthogonal';
      this._syncControlStates();
      this._savePrefs();
      this._renderCanvasOnly();
    });

    on('btnInferFks', 'click', () => {
      this.state.inferRelations = !this.state.inferRelations;
      this._syncControlStates();
      this._parseAndRender(false);
      const count = this.state.schema?.inferredRelationCount || 0;
      this.showToast(
        this.state.inferRelations
          ? `Implicit relation inference ON (${count} inferred)`
          : 'Implicit relation inference OFF'
      );
    });

    on('btnEdgeLabels', 'click', () => {
      this.state.showEdgeLabels = !this.state.showEdgeLabels;
      this._syncControlStates();
      this._savePrefs();
      this._renderCanvasOnly();
    });

    on('btnTheme', 'click', () => {
      this._applyTheme(this.state.theme === 'dark' ? 'light' : 'dark');
    });

    // Zoom & Canvas Controls
    on('btnZoomIn', 'click', () => this.viewport.zoomBy(1.2));
    on('btnZoomOut', 'click', () => this.viewport.zoomBy(1 / 1.2));
    on('btnFit', 'click', () => this.fitDiagram());
    on('btnRelayout', 'click', () => {
      this.state.pinnedPositions.clear();
      this._recomputeLayoutAndRender(true);
      this.showToast('Auto-layout applied');
    });
    on('btnSnap', 'click', () => {
      this.viewport.snapToGrid = !this.viewport.snapToGrid;
      this.dom.btnSnap.classList.toggle('is-active', this.viewport.snapToGrid);
    });
    on('btnLegend', 'click', (e) => {
      e.stopPropagation();
      this.dom.legendPopover.classList.toggle('is-open');
      this.dom.btnLegend.classList.toggle('is-active', this.dom.legendPopover.classList.contains('is-open'));
    });

    // Focus Mode controls
    on('btnFocus1Hop', 'click', () => {
      if (this.state.focusRootId) this.enterFocusMode(this.state.focusRootId, 1);
    });
    on('btnFocus2Hop', 'click', () => {
      if (this.state.focusRootId) this.enterFocusMode(this.state.focusRootId, 2);
    });
    on('btnExitFocus', 'click', () => this.exitFocusMode());

    // Inspector Close
    on('btnCloseInspector', 'click', () => this.clearSelection());

    // Sidebar Search & Tabs
    this.dom.searchInput.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.trim().toLowerCase();
      this._renderSidebarList();
    });

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.state.activeTab = btn.getAttribute('data-tab');
        this._renderSidebarList();
      });
    });

    // Hover highlights & tooltips on SVG canvas
    this.dom.erdSvg.addEventListener('pointerover', (e) => {
      const tbl = e.target.closest?.('.erd-table');
      const edge = e.target.closest?.('.erd-edge');

      if (tbl) {
        const id = tbl.getAttribute('data-table-id');
        if (this.state.hoveredTableId !== id) {
          this.state.hoveredTableId = id;
          this.state.hoveredRelationId = null;
          this._renderCanvasOnly();
        }
        this._hideTooltip();
        return;
      }

      if (edge) {
        const relId = edge.getAttribute('data-relation-id');
        if (this.state.hoveredRelationId !== relId) {
          this.state.hoveredRelationId = relId;
          this.state.hoveredTableId = null;
          this._renderCanvasOnly();
        }
        const rel = this.state.schema?.relations.find((r) => r.id === relId);
        if (rel) {
          this._showTooltip(
            e.clientX,
            e.clientY,
            `<strong>${escapeXml(rel.sourceTableId)}.${escapeXml(rel.sourceColumns.join(', '))}</strong> → <strong>${escapeXml(rel.targetTableId)}.${escapeXml(rel.targetColumns.join(', '))}</strong><br><span style="color:var(--text-muted)">${rel.cardinality}${rel.onDelete ? ` · ON DELETE ${rel.onDelete}` : ''}${rel.inferred ? ' · Inferred' : ''}</span>`
          );
        }
        return;
      }

      if (this.state.hoveredTableId || this.state.hoveredRelationId) {
        this.state.hoveredTableId = null;
        this.state.hoveredRelationId = null;
        this._renderCanvasOnly();
        this._hideTooltip();
      }
    });

    this.dom.erdSvg.addEventListener('pointermove', (e) => {
      if (this.dom.hoverTooltip.classList.contains('is-visible')) {
        this.dom.hoverTooltip.style.left = `${e.clientX + 14}px`;
        this.dom.hoverTooltip.style.top = `${e.clientY + 14}px`;
      }
    });

    this.dom.erdSvg.addEventListener('pointerleave', () => {
      if (this.state.hoveredTableId || this.state.hoveredRelationId) {
        this.state.hoveredTableId = null;
        this.state.hoveredRelationId = null;
        this._renderCanvasOnly();
      }
      this._hideTooltip();
    });

    // Export Actions
    this.dom.exportDropdown.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-export]');
      if (!btn) return;
      this.dom.exportDropdown.classList.remove('is-open');
      await this._handleExport(btn.getAttribute('data-export'));
    });

    // Export Modal Buttons
    on('btnCloseModal', 'click', () => this.dom.exportModal.classList.remove('is-open'));
    this.dom.exportModal.addEventListener('click', (e) => {
      if (e.target === this.dom.exportModal) this.dom.exportModal.classList.remove('is-open');
    });
    on('btnCopyExport', 'click', async () => {
      if (!this._modalExport) return;
      try {
        await navigator.clipboard.writeText(this._modalExport.content);
        this.showToast('Copied to clipboard');
      } catch {
        this.showToast('Copy failed — please select and copy manually');
      }
    });
    on('btnDownloadExport', 'click', () => {
      if (!this._modalExport) return;
      this._downloadText(this._modalExport.content, this._modalExport.filename, this._modalExport.mime);
      this.showToast(`Downloaded ${this._modalExport.filename}`);
    });

    // Minimap Click / Drag Navigation
    let minimapDragging = false;
    const navigateFromMinimap = (e) => {
      if (!this.state.layout?.bounds) return;
      const rect = this.dom.minimap.getBoundingClientRect();
      const b = this.state.layout.bounds;
      const rx = (e.clientX - rect.left) / rect.width;
      const ry = (e.clientY - rect.top) / rect.height;
      const wx = b.minX + rx * b.width;
      const wy = b.minY + ry * b.height;
      this.viewport.centerOnWorldPoint(wx, wy);
    };
    this.dom.minimap.addEventListener('pointerdown', (e) => {
      minimapDragging = true;
      navigateFromMinimap(e);
    });
    window.addEventListener('pointermove', (e) => {
      if (minimapDragging) navigateFromMinimap(e);
    });
    window.addEventListener('pointerup', () => {
      minimapDragging = false;
    });

    // Window Drag-and-Drop .sql files
    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      this.dom.dropOverlay.classList.add('is-visible');
    });
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    window.addEventListener('dragleave', () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) this.dom.dropOverlay.classList.remove('is-visible');
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      this.dom.dropOverlay.classList.remove('is-visible');
      const file = e.dataTransfer?.files?.[0];
      if (file) this._handleUploadedFile(file);
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const targetTag = (e.target?.tagName || '').toLowerCase();
      const inInput = targetTag === 'textarea' || targetTag === 'input' || targetTag === 'select';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.dom.sqlFileInput.click();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.dom.sidebar.classList.remove('is-collapsed');
        this.dom.searchInput.focus();
        this.dom.searchInput.select();
        return;
      }
      if (e.key === 'Escape') {
        this.dom.exportModal.classList.remove('is-open');
        this.dom.legendPopover.classList.remove('is-open');
        this.dom.btnLegend.classList.remove('is-active');
        if (this.state.focusRootId) this.exitFocusMode();
        else this.clearSelection();
        return;
      }
      if (inInput) return;

      if (e.key === 'f' || e.key === 'F') this.fitDiagram();
      else if (e.key === 'l' || e.key === 'L') {
        this.state.pinnedPositions.clear();
        this._recomputeLayoutAndRender(true);
      } else if (e.key === 'e' || e.key === 'E') {
        toggleEditor();
      } else if (e.key === '+' || e.key === '=') {
        this.viewport.zoomBy(1.18);
      } else if (e.key === '-') {
        this.viewport.zoomBy(1 / 1.18);
      } else if (e.key === '0') {
        this.viewport.resetZoom();
      }
    });
  }

  async _handleUploadedFile(file) {
    try {
      const text = await file.text();
      if (file.name.endsWith('.erd.json')) {
        const saved = JSON.parse(text);
        if (typeof saved.sql === 'string') {
          this.state.pinnedPositions = new Map(Object.entries(saved.positions || {}));
          if (saved.algorithm) this.state.algorithm = saved.algorithm;
          if (saved.detailMode) this.state.detailMode = saved.detailMode;
          if (typeof saved.inferRelations === 'boolean') this.state.inferRelations = saved.inferRelations;
          this._syncControlStates();
          this.loadSql(saved.sql, saved.fileName || file.name, false);
          this.fitDiagram();
          this.showToast(`Restored workspace: ${file.name}`);
          return;
        }
      }
      this.loadSql(text, file.name, true);
      const st = this.state.schema?.stats;
      if (st) {
        if (st.tableCount > 0 && st.explicitRelationCount === 0 && !this.state.inferRelations) {
          this.showToast(
            `Loaded ${st.tableCount} tables (no explicit FKs found — try "Infer FKs"!)`
          );
        } else {
          this.showToast(
            `Loaded ${file.name}: ${st.tableCount} tables, ${st.relationCount} relations`
          );
        }
      }
    } catch (err) {
      this.showToast(`Failed to read file: ${err.message}`);
    }
  }

  loadSql(sqlText, fileName = 'schema.sql', resetPositions = true) {
    this.state.sql = sqlText;
    this.state.fileName = fileName;
    this.dom.sqlEditor.value = sqlText;
    this.dom.editorTitle.textContent = fileName;
    this.dom.fileNameLabel.textContent = fileName;
    this._updateEditorLineCount(sqlText);

    if (resetPositions) {
      this.state.pinnedPositions.clear();
      this.state.hiddenTableIds.clear();
      this.state.activeSchemaFilter = null;
      this.state.focusRootId = null;
      this.state.selectedTableId = null;
      this.state.selectedRelationId = null;
    }

    this._parseAndRender(true);
  }

  _updateEditorLineCount(text) {
    const lines = text ? text.split(/\r?\n/).length : 0;
    this.dom.editorStats.textContent = `${lines.toLocaleString()} lines`;
  }

  _parseAndRender(shouldFit) {
    const schema = parseSqlToSchema(this.state.sql, {
      inferRelations: this.state.inferRelations,
      createExternalStubs: true,
    });
    this.state.schema = schema;

    // Update top stats
    this.dom.statTables.textContent = schema.stats.tableCount;
    this.dom.statRelations.textContent = schema.stats.relationCount;
    this.dom.statColumns.textContent = schema.stats.columnCount;
    this.dom.dialectBadge.textContent = schema.dialect;
    this.dom.tabDiagnostics.textContent =
      schema.warnings.length > 0 ? `Info (${schema.warnings.length})` : 'Info';

    this._renderSchemaChips();
    this._recomputeLayoutAndRender(shouldFit);
    this._renderSidebarList();
    this._renderInspector();
  }

  _getVisibleTableIdSet() {
    const schema = this.state.schema;
    if (!schema) return new Set();

    let ids = new Set(schema.tables.map((t) => t.id));

    // Apply schema filter
    if (this.state.activeSchemaFilter) {
      ids = new Set(
        schema.tables
          .filter((t) => (t.schema || '(default)') === this.state.activeSchemaFilter)
          .map((t) => t.id)
      );
    }

    // Apply user hidden tables
    for (const hid of this.state.hiddenTableIds) {
      ids.delete(hid);
    }

    // Apply Focus Mode neighborhood filter
    if (this.state.focusRootId && schema.tables.some((t) => t.id === this.state.focusRootId)) {
      const neighborhood = this._getNeighborhood(this.state.focusRootId, this.state.focusHops);
      ids = new Set([...ids].filter((id) => neighborhood.has(id)));
      ids.add(this.state.focusRootId);
    }

    return ids;
  }

  _getNeighborhood(rootId, hops = 1) {
    const visited = new Set([rootId]);
    let frontier = new Set([rootId]);
    const rels = this.state.schema?.relations || [];

    for (let h = 0; h < hops; h++) {
      const next = new Set();
      for (const r of rels) {
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
    return visited;
  }

  _recomputeLayoutAndRender(shouldFit) {
    const schema = this.state.schema;
    if (!schema) return;

    const visibleIds = this._getVisibleTableIdSet();
    this.dom.emptyState.classList.toggle('is-visible', schema.tables.length === 0);

    this.state.layout = computeErdLayout(schema, {
      algorithm: this.state.algorithm,
      detailMode: this.state.detailMode,
      showTypes: true,
      visibleTableIds: visibleIds,
      pinnedPositions: this.state.pinnedPositions,
    });

    this._renderCanvasOnly();
    this._renderMinimap();
    this._updateFocusBanner();

    if (shouldFit && this.state.layout.nodes.size > 0) {
      requestAnimationFrame(() => this.fitDiagram());
    }
  }

  _recomputeBounds() {
    if (!this.state.layout || this.state.layout.nodes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.state.layout.nodes.values()) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
    const pad = 80;
    this.state.layout.bounds = {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: Math.max(400, maxX - minX + pad * 2),
      height: Math.max(300, maxY - minY + pad * 2),
    };
  }

  _renderCanvasOnly() {
    if (!this.state.schema || !this.state.layout) return;
    this.dom.erdWorld.innerHTML = renderErdSvg(this.state.schema, this.state.layout, {
      theme: this.state.theme,
      detailMode: this.state.detailMode,
      showTypes: true,
      showNullability: true,
      showEdgeLabels: this.state.showEdgeLabels,
      edgeStyle: this.state.edgeStyle,
      selectedTableId: this.state.selectedTableId,
      hoveredTableId: this.state.hoveredTableId,
      selectedRelationId: this.state.selectedRelationId,
      hoveredRelationId: this.state.hoveredRelationId,
      standalone: false,
    });
  }

  _renderMinimap() {
    const layout = this.state.layout;
    if (!layout || layout.nodes.size === 0) {
      this.dom.minimapSvg.innerHTML = '';
      return;
    }

    const b = layout.bounds;
    const vp = this.viewport.getState();

    // Viewport rectangle in world coordinates
    const vx = -vp.tx / vp.scale;
    const vy = -vp.ty / vp.scale;
    const vw = vp.viewportWidth / vp.scale;
    const vh = vp.viewportHeight / vp.scale;

    const rects = [];
    for (const n of layout.nodes.values()) {
      const isSel = n.id === this.state.selectedTableId;
      rects.push(
        `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="12" fill="${isSel ? '#3b82f6' : '#64748b'}" opacity="${isSel ? '0.95' : '0.45'}"/>`
      );
    }

    this.dom.minimapSvg.setAttribute('viewBox', `${b.minX} ${b.minY} ${b.width} ${b.height}`);
    this.dom.minimapSvg.innerHTML = `
      ${rects.join('')}
      <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="rgba(59,130,246,0.12)" stroke="#3b82f6" stroke-width="${Math.max(6, b.width * 0.008)}"/>
    `;
  }

  _renderSchemaChips() {
    const schemas = this.state.schema?.schemas || [];
    if (schemas.length <= 1) {
      this.dom.schemaChips.innerHTML = '';
      return;
    }

    const allChips = [
      `<button class="chip${!this.state.activeSchemaFilter ? ' is-active' : ''}" data-schema="">All (${this.state.schema.tables.length})</button>`,
      ...schemas.map((s) => {
        const count = this.state.schema.tables.filter((t) => t.schema === s).length;
        const active = this.state.activeSchemaFilter === s ? ' is-active' : '';
        return `<button class="chip${active}" data-schema="${escapeXml(s)}">${escapeXml(s)} (${count})</button>`;
      }),
    ];
    this.dom.schemaChips.innerHTML = allChips.join('');
    this.dom.schemaChips.onclick = (e) => {
      const chip = e.target.closest('[data-schema]');
      if (!chip) return;
      const val = chip.getAttribute('data-schema');
      this.state.activeSchemaFilter = val || null;
      this._renderSchemaChips();
      this._recomputeLayoutAndRender(true);
      this._renderSidebarList();
    };
  }

  _renderSidebarList() {
    const schema = this.state.schema;
    if (!schema) return;
    const q = this.state.searchQuery;

    if (this.state.activeTab === 'tables') {
      const filtered = schema.tables.filter((t) => {
        if (this.state.activeSchemaFilter && (t.schema || '(default)') !== this.state.activeSchemaFilter) {
          return false;
        }
        if (!q) return true;
        return (
          t.id.toLowerCase().includes(q) ||
          t.columns.some((c) => c.name.toLowerCase().includes(q))
        );
      });

      if (filtered.length === 0) {
        this.dom.sidebarList.innerHTML = `<div style="padding:16px;color:var(--text-muted);text-align:center">No matching tables</div>`;
        return;
      }

      this.dom.sidebarList.innerHTML = filtered
        .map((t) => {
          const isHidden = this.state.hiddenTableIds.has(t.id);
          const isSel = this.state.selectedTableId === t.id;
          const fkCount = t.columns.filter((c) => c.isForeignKey).length;
          const sub = `${t.columns.length} cols · ${t.primaryKeys.length} PK · ${fkCount} FK${t.isExternal ? ' · EXT' : ''}`;
          return `
            <div class="list-item${isSel ? ' is-selected' : ''}${isHidden ? ' is-hidden-table' : ''}" data-list-table="${escapeXml(t.id)}">
              <div class="list-item-main">
                <div class="list-item-title">${escapeXml(t.id)}</div>
                <div class="list-item-sub">${escapeXml(sub)}</div>
              </div>
              <button class="eye-btn" data-toggle-vis="${escapeXml(t.id)}" title="${isHidden ? 'Show table' : 'Hide table'}">
                ${isHidden ? '○' : '●'}
              </button>
            </div>`;
        })
        .join('');

      this.dom.sidebarList.onclick = (e) => {
        const visBtn = e.target.closest('[data-toggle-vis]');
        if (visBtn) {
          e.stopPropagation();
          const id = visBtn.getAttribute('data-toggle-vis');
          if (this.state.hiddenTableIds.has(id)) this.state.hiddenTableIds.delete(id);
          else this.state.hiddenTableIds.add(id);
          this._recomputeLayoutAndRender(false);
          this._renderSidebarList();
          return;
        }
        const row = e.target.closest('[data-list-table]');
        if (row) {
          const id = row.getAttribute('data-list-table');
          this.state.hiddenTableIds.delete(id);
          this.selectTable(id, true);
        }
      };
      return;
    }

    if (this.state.activeTab === 'relations') {
      const filtered = schema.relations.filter((r) => {
        if (!q) return true;
        return (
          r.sourceTableId.toLowerCase().includes(q) ||
          r.targetTableId.toLowerCase().includes(q) ||
          r.sourceColumns.some((c) => c.toLowerCase().includes(q)) ||
          r.targetColumns.some((c) => c.toLowerCase().includes(q)) ||
          (r.name || '').toLowerCase().includes(q)
        );
      });

      if (filtered.length === 0) {
        this.dom.sidebarList.innerHTML = `<div style="padding:16px;color:var(--text-muted);text-align:center">${
          schema.relations.length === 0
            ? 'No explicit foreign keys found.<br><br>Try enabling <b>Infer FKs</b> in the top bar!'
            : 'No matching relationships'
        }</div>`;
        return;
      }

      this.dom.sidebarList.innerHTML = filtered
        .map((r) => {
          const isSel = this.state.selectedRelationId === r.id;
          return `
            <div class="rel-card${isSel ? ' is-selected' : ''}" data-list-rel="${escapeXml(r.id)}">
              <div class="rel-card-line">${escapeXml(r.sourceTableId)}.${escapeXml(r.sourceColumns.join(','))} → ${escapeXml(r.targetTableId)}.${escapeXml(r.targetColumns.join(','))}</div>
              <div class="rel-card-meta">
                <span class="badge badge-fk">${escapeXml(r.cardinality)}</span>
                ${r.onDelete ? `<span class="badge badge-neutral">DEL: ${escapeXml(r.onDelete)}</span>` : ''}
                ${r.isSelfReference ? `<span class="badge badge-uk">SELF</span>` : ''}
                ${r.inferred ? `<span class="badge badge-warn">INFERRED</span>` : ''}
              </div>
            </div>`;
        })
        .join('');

      this.dom.sidebarList.onclick = (e) => {
        const card = e.target.closest('[data-list-rel]');
        if (card) {
          this.selectRelation(card.getAttribute('data-list-rel'), true);
        }
      };
      return;
    }

    // Diagnostics / Info tab
    const parts = [];
    parts.push(`
      <div class="rel-card" style="cursor:default">
        <div class="rel-card-line">Parse Summary</div>
        <div class="rel-card-meta" style="display:block;line-height:1.65;margin-top:6px">
          Dialect: <strong>${escapeXml(schema.dialect)}</strong><br>
          Tables: <strong>${schema.stats.tableCount}</strong>${schema.stats.externalTableCount ? ` (+${schema.stats.externalTableCount} external stubs)` : ''}<br>
          Explicit FKs: <strong>${schema.stats.explicitRelationCount}</strong><br>
          Inferred FKs: <strong>${schema.stats.inferredRelationCount}</strong><br>
          Skipped non-DDL stmts: <strong>${schema.stats.skippedStatements}</strong>
        </div>
      </div>`);

    if (schema.enums.length > 0) {
      parts.push(`<div class="inspector-section-title" style="padding:6px 4px 2px">Enums (${schema.enums.length})</div>`);
      for (const en of schema.enums) {
        parts.push(`
          <div class="rel-card" style="cursor:default">
            <div class="rel-card-line">${escapeXml(en.schema ? `${en.schema}.${en.name}` : en.name)}</div>
            <div class="rel-card-meta">${escapeXml(en.values.join(', '))}</div>
          </div>`);
      }
    }

    if (schema.warnings.length > 0) {
      parts.push(`<div class="inspector-section-title" style="padding:6px 4px 2px">Notices (${schema.warnings.length})</div>`);
      for (const w of schema.warnings) {
        parts.push(`<div class="rel-card" style="cursor:default;border-color:rgba(245,158,11,0.4)"><div style="font-size:11.5px;color:var(--warning)">${escapeXml(w)}</div></div>`);
      }
    }

    this.dom.sidebarList.innerHTML = parts.join('');
    this.dom.sidebarList.onclick = null;
  }

  selectTable(tableId, centerView = false) {
    this.state.selectedTableId = tableId;
    this.state.selectedRelationId = null;

    if (!this.state.layout?.nodes.has(tableId)) {
      this._recomputeLayoutAndRender(false);
    } else {
      this._renderCanvasOnly();
      this._renderMinimap();
    }

    if (centerView) {
      const n = this.state.layout?.nodes.get(tableId);
      if (n) this.viewport.centerOnRect(n.x, n.y, n.width, n.height);
    }

    this._renderSidebarList();
    this._renderInspector();
  }

  selectRelation(relId, centerView = false) {
    this.state.selectedRelationId = relId;
    this.state.selectedTableId = null;
    this._renderCanvasOnly();
    this._renderSidebarList();
    this._renderInspector();

    if (centerView) {
      const rel = this.state.schema?.relations.find((r) => r.id === relId);
      const src = rel && this.state.layout?.nodes.get(rel.sourceTableId);
      const tgt = rel && this.state.layout?.nodes.get(rel.targetTableId);
      if (src && tgt) {
        const minX = Math.min(src.x, tgt.x);
        const minY = Math.min(src.y, tgt.y);
        const maxX = Math.max(src.x + src.width, tgt.x + tgt.width);
        const maxY = Math.max(src.y + src.height, tgt.y + tgt.height);
        this.viewport.centerOnRect(minX, minY, maxX - minX, maxY - minY);
      }
    }
  }

  clearSelection() {
    this.state.selectedTableId = null;
    this.state.selectedRelationId = null;
    this._renderCanvasOnly();
    this._renderSidebarList();
    this._renderInspector();
  }

  enterFocusMode(tableId, hops = 1) {
    this.state.focusRootId = tableId;
    this.state.focusHops = hops;
    this.state.selectedTableId = tableId;
    this.state.pinnedPositions.clear();
    this._recomputeLayoutAndRender(true);
    this._renderInspector();
  }

  exitFocusMode() {
    this.state.focusRootId = null;
    this.state.pinnedPositions.clear();
    this._recomputeLayoutAndRender(true);
  }

  _updateFocusBanner() {
    const active = Boolean(this.state.focusRootId);
    this.dom.focusBanner.classList.toggle('is-visible', active);
    if (active) {
      const visibleCount = this.state.layout?.nodes.size || 0;
      this.dom.focusBannerText.textContent = `Focus: ${this.state.focusRootId} (${visibleCount} tables)`;
      this.dom.btnFocus1Hop.classList.toggle('is-active', this.state.focusHops === 1);
      this.dom.btnFocus2Hop.classList.toggle('is-active', this.state.focusHops === 2);
    }
  }

  _renderInspector() {
    const schema = this.state.schema;
    if (!schema) {
      this.dom.inspector.classList.remove('is-open');
      return;
    }

    if (this.state.selectedTableId) {
      const tbl = schema.tables.find((t) => t.id === this.state.selectedTableId);
      if (!tbl) {
        this.dom.inspector.classList.remove('is-open');
        return;
      }

      const outgoing = schema.relations.filter((r) => r.sourceTableId === tbl.id);
      const incoming = schema.relations.filter((r) => r.targetTableId === tbl.id && !r.isSelfReference);

      this.dom.inspectorTitle.textContent = tbl.id;
      this.dom.inspectorSub.textContent = `${tbl.columns.length} columns · ${outgoing.length} outgoing · ${incoming.length} incoming${tbl.isJunctionTable ? ' · Junction Table' : ''}`;

      const colRows = tbl.columns
        .map((c) => {
          const badges = [
            c.isPrimaryKey ? '<span class="badge badge-pk">PK</span>' : '',
            c.isForeignKey ? '<span class="badge badge-fk">FK</span>' : '',
            c.isUnique && !c.isPrimaryKey ? '<span class="badge badge-uk">UK</span>' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return `
            <div class="inspector-col-row">
              <div style="min-width:0">
                <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
                  ${badges}
                  <strong>${escapeXml(c.name)}</strong>
                  ${c.nullable ? '<span style="color:var(--text-muted);font-size:10.5px">null</span>' : ''}
                </div>
                ${c.references ? `<div style="font-size:10.5px;color:var(--accent-hover);font-family:var(--font-mono)">→ ${escapeXml(c.references.tableId)}.${escapeXml(c.references.column)}</div>` : ''}
                ${c.comment ? `<div style="font-size:10.5px;color:var(--text-muted)">${escapeXml(c.comment)}</div>` : ''}
              </div>
              <span class="inspector-col-type" title="${escapeXml(c.type)}">${escapeXml(c.type)}</span>
            </div>`;
        })
        .join('');

      const relChips = [
        ...outgoing.map(
          (r) => `<button class="neighbor-chip" data-jump-table="${escapeXml(r.targetTableId)}">→ ${escapeXml(r.targetTableId)} (${r.cardinality})</button>`
        ),
        ...incoming.map(
          (r) => `<button class="neighbor-chip" data-jump-table="${escapeXml(r.sourceTableId)}">← ${escapeXml(r.sourceTableId)} (${r.cardinality})</button>`
        ),
      ].join('');

      this.dom.inspectorBody.innerHTML = `
        ${tbl.comment ? `<div style="font-size:12px;color:var(--text-secondary);background:var(--bg-elevated);padding:8px;border-radius:6px">${escapeXml(tbl.comment)}</div>` : ''}
        <div class="inspector-actions">
          <button class="btn btn-sm btn-primary" id="btnInspFocus">Focus Connected</button>
          <button class="btn btn-sm" id="btnInspCenter">Center</button>
          <button class="btn btn-sm" id="btnInspHide">Hide Table</button>
        </div>
        ${
          relChips
            ? `<div><div class="inspector-section-title">Connected Tables</div><div class="inspector-actions">${relChips}</div></div>`
            : ''
        }
        <div>
          <div class="inspector-section-title">Columns (${tbl.columns.length})</div>
          ${colRows}
        </div>
      `;

      this.dom.inspectorBody.querySelector('#btnInspFocus')?.addEventListener('click', () => {
        this.enterFocusMode(tbl.id, 1);
      });
      this.dom.inspectorBody.querySelector('#btnInspCenter')?.addEventListener('click', () => {
        this.selectTable(tbl.id, true);
      });
      this.dom.inspectorBody.querySelector('#btnInspHide')?.addEventListener('click', () => {
        this.state.hiddenTableIds.add(tbl.id);
        this.clearSelection();
        this._recomputeLayoutAndRender(false);
        this._renderSidebarList();
      });
      this.dom.inspectorBody.querySelectorAll('[data-jump-table]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectTable(btn.getAttribute('data-jump-table'), true);
        });
      });

      this.dom.inspector.classList.add('is-open');
      return;
    }

    if (this.state.selectedRelationId) {
      const rel = schema.relations.find((r) => r.id === this.state.selectedRelationId);
      if (!rel) {
        this.dom.inspector.classList.remove('is-open');
        return;
      }

      this.dom.inspectorTitle.textContent = rel.name || 'Relationship';
      this.dom.inspectorSub.textContent = `${rel.cardinality} · ${rel.inferred ? 'Inferred from naming' : 'Explicit Foreign Key'}`;

      const mappingRows = rel.sourceColumns
        .map((sc, idx) => {
          const tc = rel.targetColumns[idx] || rel.targetColumns[0] || 'id';
          return `<div class="inspector-col-row"><span style="font-family:var(--font-mono)">${escapeXml(rel.sourceTableId)}.<strong>${escapeXml(sc)}</strong></span><span>→</span><span style="font-family:var(--font-mono)">${escapeXml(rel.targetTableId)}.<strong>${escapeXml(tc)}</strong></span></div>`;
        })
        .join('');

      this.dom.inspectorBody.innerHTML = `
        <div class="inspector-actions">
          <button class="neighbor-chip" data-jump-table="${escapeXml(rel.sourceTableId)}">Child: ${escapeXml(rel.sourceTableId)}</button>
          <button class="neighbor-chip" data-jump-table="${escapeXml(rel.targetTableId)}">Parent: ${escapeXml(rel.targetTableId)}</button>
        </div>
        <div>
          <div class="inspector-section-title">Column Mapping</div>
          ${mappingRows}
        </div>
        <div>
          <div class="inspector-section-title">Properties</div>
          <div class="inspector-col-row"><span>Cardinality</span><strong>${escapeXml(rel.cardinality)} (${escapeXml(rel.sourceEnd)} → ${escapeXml(rel.targetEnd)})</strong></div>
          <div class="inspector-col-row"><span>ON DELETE</span><strong>${escapeXml(rel.onDelete || 'NO ACTION')}</strong></div>
          <div class="inspector-col-row"><span>ON UPDATE</span><strong>${escapeXml(rel.onUpdate || 'NO ACTION')}</strong></div>
          <div class="inspector-col-row"><span>Self-Referencing</span><strong>${rel.isSelfReference ? 'Yes' : 'No'}</strong></div>
        </div>
      `;

      this.dom.inspectorBody.querySelectorAll('[data-jump-table]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectTable(btn.getAttribute('data-jump-table'), true);
        });
      });

      this.dom.inspector.classList.add('is-open');
      return;
    }

    this.dom.inspector.classList.remove('is-open');
  }

  fitDiagram() {
    if (this.state.layout?.bounds) {
      this.viewport.fitBounds(this.state.layout.bounds, 48);
    }
  }

  async _handleExport(type) {
    if (!this.state.schema || !this.state.layout) return;
    const baseName = (this.state.fileName || 'erd').replace(/\.(sql|ddl|txt|erd\.json)$/i, '');

    if (type === 'svg') {
      const svg = exportSvg(this.state.schema, this.state.layout, {
        theme: this.state.theme,
        detailMode: this.state.detailMode,
        edgeStyle: this.state.edgeStyle,
        showEdgeLabels: this.state.showEdgeLabels,
        includeGrid: true,
      });
      this._downloadText(svg, `${baseName}-erd.svg`, 'image/svg+xml;charset=utf-8');
      this.showToast(`Exported ${baseName}-erd.svg`);
      return;
    }

    if (type === 'png') {
      try {
        const svg = exportSvg(this.state.schema, this.state.layout, {
          theme: this.state.theme,
          detailMode: this.state.detailMode,
          edgeStyle: this.state.edgeStyle,
          showEdgeLabels: this.state.showEdgeLabels,
          includeGrid: true,
        });
        const blob = await exportPngBlob(svg, 2);
        this._downloadBlob(blob, `${baseName}-erd.png`);
        this.showToast(`Exported ${baseName}-erd.png (2x HD)`);
      } catch (err) {
        this.showToast(`PNG export failed: ${err.message}`);
      }
      return;
    }

    if (type === 'workspace') {
      const payload = JSON.stringify(
        {
          version: 1,
          fileName: this.state.fileName,
          sql: this.state.sql,
          algorithm: this.state.algorithm,
          detailMode: this.state.detailMode,
          inferRelations: this.state.inferRelations,
          positions: Object.fromEntries(this.state.pinnedPositions.entries()),
        },
        null,
        2
      );
      this._downloadText(payload, `${baseName}.erd.json`, 'application/json');
      this.showToast(`Saved workspace ${baseName}.erd.json`);
      return;
    }

    let content = '';
    let filename = '';
    let title = '';
    let mime = 'text/plain;charset=utf-8';

    if (type === 'mermaid') {
      content = exportMermaid(this.state.schema);
      filename = `${baseName}-erd.mmd`;
      title = 'Mermaid ERD Export';
    } else if (type === 'dbml') {
      content = exportDbml(this.state.schema);
      filename = `${baseName}.dbml`;
      title = 'DBML Schema Export';
    } else if (type === 'markdown') {
      content = exportMarkdownDocs(this.state.schema);
      filename = `${baseName}-docs.md`;
      title = 'Markdown Data Dictionary';
      mime = 'text/markdown;charset=utf-8';
    } else if (type === 'json') {
      content = exportJson(this.state.schema, this.state.layout);
      filename = `${baseName}-schema.json`;
      title = 'JSON Schema Export';
      mime = 'application/json';
    }

    this._modalExport = { content, filename, mime };
    this.dom.modalTitle.textContent = title;
    this.dom.modalCode.textContent = content;
    this.dom.exportModal.classList.add('is-open');
  }

  _downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    this._downloadBlob(blob, filename);
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  _showTooltip(x, y, html) {
    this.dom.hoverTooltip.innerHTML = html;
    this.dom.hoverTooltip.style.left = `${x + 14}px`;
    this.dom.hoverTooltip.style.top = `${y + 14}px`;
    this.dom.hoverTooltip.classList.add('is-visible');
  }

  _hideTooltip() {
    this.dom.hoverTooltip.classList.remove('is-visible');
  }

  showToast(message) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.dom.toast.classList.remove('is-visible');
    }, 2800);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__sqlToErdApp = new SqlToErdApp();
});
