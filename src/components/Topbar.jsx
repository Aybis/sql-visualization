import React from 'react';
import {
  PanelLeft,
  Upload,
  ChevronDown,
  Code2,
  Download,
  Sun,
  Moon,
  Sparkles,
  Tag,
  GitBranch,
  Database,
  FileCode2,
  FileText,
  FileJson,
  Image,
  Save,
} from 'lucide-react';
import { SAMPLE_PRESETS } from '@/samples/presets.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Topbar({
  sidebarOpen,
  onToggleSidebar,
  onOpenFile,
  onSelectSample,
  editorOpen,
  onToggleEditor,
  algorithm,
  onChangeAlgorithm,
  detailMode,
  onChangeDetailMode,
  edgeStyle,
  onToggleEdgeStyle,
  inferRelations,
  onToggleInferRelations,
  showEdgeLabels,
  onToggleEdgeLabels,
  onExport,
  theme,
  onToggleTheme,
}) {
  return (
    <header className="z-30 flex h-13 shrink-0 items-center justify-between gap-2.5 border-b border-border bg-card px-3">
      {/* Left group */}
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex select-none items-center gap-2 border-r border-border pr-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-xs">
            <Database className="h-4 w-4" />
          </div>
          <span className="hidden whitespace-nowrap text-sm font-bold tracking-tight lg:inline">
            SQL → ERD
          </span>
          <Badge
            variant="success"
            className="hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold lg:inline-flex"
            title="Runs 100% locally with zero internet access"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Offline
          </Badge>
        </div>

        <Button
          id="btnToggleSidebar"
          variant={sidebarOpen ? 'active' : 'outline'}
          size="icon"
          title="Toggle Explorer Sidebar"
          onClick={onToggleSidebar}
        >
          <PanelLeft />
        </Button>

        <Button
          id="btnOpenFile"
          variant="default"
          title="Open local .sql file (Ctrl/Cmd + O)"
          onClick={onOpenFile}
        >
          <Upload />
          Open .sql
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="btnSamples" variant="outline">
              Samples
              <ChevronDown className="opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" id="samplesMenu" className="w-80">
            {Object.entries(SAMPLE_PRESETS).map(([key, sample]) => (
              <DropdownMenuItem
                key={key}
                data-sample={key}
                onSelect={() => onSelectSample(key, sample)}
              >
                <span className="truncate font-medium">{sample.name}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                  {sample.dialect}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          id="btnToggleEditor"
          variant={editorOpen ? 'active' : 'outline'}
          title="Show/Hide Live SQL Editor (E)"
          onClick={onToggleEditor}
        >
          <Code2 />
          SQL Editor
        </Button>
      </div>

      {/* Right group */}
      <div className="flex min-w-0 items-center gap-1.5">
        <select
          id="selectLayout"
          title="Layout Algorithm"
          value={algorithm}
          onChange={(e) => onChangeAlgorithm(e.target.value)}
          className="h-8 cursor-pointer rounded-md border border-border bg-secondary/70 px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus:ring-1 focus:ring-ring"
        >
          <option value="hierarchical">Layout: Hierarchical</option>
          <option value="clustered">Layout: Clustered</option>
          <option value="grid">Layout: Grid</option>
        </select>

        <select
          id="selectDetail"
          title="Table Card Detail Level"
          value={detailMode}
          onChange={(e) => onChangeDetailMode(e.target.value)}
          className="h-8 cursor-pointer rounded-md border border-border bg-secondary/70 px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus:ring-1 focus:ring-ring"
        >
          <option value="full">Detail: All Columns</option>
          <option value="keys">Detail: Keys Only</option>
          <option value="compact">Detail: Compact</option>
        </select>

        <Button
          id="btnEdgeStyle"
          variant="outline"
          title="Toggle Orthogonal / Curved Connectors"
          onClick={onToggleEdgeStyle}
        >
          <GitBranch />
          {edgeStyle === 'orthogonal' ? 'Orthogonal' : 'Curved'}
        </Button>

        <Button
          id="btnInferFks"
          variant={inferRelations ? 'active' : 'outline'}
          title="Infer implicit relations from *_id columns when SQL omits FOREIGN KEY constraints"
          onClick={onToggleInferRelations}
        >
          <Sparkles />
          Infer FKs
        </Button>

        <Button
          id="btnEdgeLabels"
          variant={showEdgeLabels ? 'active' : 'outline'}
          title="Always show cardinality labels on relationship lines"
          onClick={onToggleEdgeLabels}
        >
          <Tag />
          Labels
        </Button>

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="btnExport" variant="outline">
              <Download />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem data-export="svg" onSelect={() => onExport('svg')}>
              <span className="flex items-center gap-2"><Image className="h-3.5 w-3.5 text-muted-foreground" />Download SVG Vector</span>
              <span className="font-mono text-[10.5px] text-muted-foreground">.svg</span>
            </DropdownMenuItem>
            <DropdownMenuItem data-export="png" onSelect={() => onExport('png')}>
              <span className="flex items-center gap-2"><Image className="h-3.5 w-3.5 text-muted-foreground" />Download PNG (2x HD)</span>
              <span className="font-mono text-[10.5px] text-muted-foreground">.png</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-export="mermaid" onSelect={() => onExport('mermaid')}>
              <span className="flex items-center gap-2"><FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />Mermaid ERD</span>
              <span className="font-mono text-[10.5px] text-muted-foreground">.mmd</span>
            </DropdownMenuItem>
            <DropdownMenuItem data-export="dbml" onSelect={() => onExport('dbml')}>
              <span className="flex items-center gap-2"><FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />DBML Schema</span>
              <span className="font-mono text-[10.5px] text-muted-foreground">.dbml</span>
            </DropdownMenuItem>
            <DropdownMenuItem data-export="markdown" onSelect={() => onExport('markdown')}>
              <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" />Markdown Docs</span>
              <span className="font-mono text-[10.5px] text-muted-foreground">.md</span>
            </DropdownMenuItem>
            <DropdownMenuItem data-export="json" onSelect={() => onExport('json')}>
              <span className="flex items-center gap-2"><FileJson className="h-3.5 w-3.5 text-muted-foreground" />JSON Schema</span>
              <span className="font-mono text-[10.5px] text-muted-foreground">.json</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-export="workspace" onSelect={() => onExport('workspace')}>
              <span className="flex items-center gap-2"><Save className="h-3.5 w-3.5 text-muted-foreground" />Save Workspace</span>
              <span className="font-mono text-[10.5px] text-muted-foreground">.erd.json</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          id="btnTheme"
          variant="outline"
          size="icon"
          title="Toggle Dark / Light Theme"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  );
}
