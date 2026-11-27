import React from 'react';
import { motion } from 'framer-motion';
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
  FileCode2,
  FileText,
  FileJson,
  Image,
  Save,
  Check,
  GitFork,
  Orbit,
  LayoutGrid,
  Rows3,
  KeyRound,
  Square,
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

/**
 * Custom Geometric Logo Mark for Schemata
 * Minimalist interconnected entity cards + node dot
 */
function SchemataLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="8" height="6.5" rx="2" stroke="currentColor" strokeWidth="2.1" />
      <rect x="13" y="13.5" width="8" height="6.5" rx="2" stroke="currentColor" strokeWidth="2.1" />
      <path
        d="M11 7.25H15C16.1046 7.25 17 8.14543 17 9.25V13.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="7" cy="17" r="2.2" fill="currentColor" />
    </svg>
  );
}

const LAYOUT_OPTIONS = [
  { value: 'hierarchical', label: 'Hierarchical', desc: 'Parent → child flow', Icon: GitFork },
  { value: 'clustered', label: 'Clustered', desc: 'Organic grouped graph', Icon: Orbit },
  { value: 'grid', label: 'Grid', desc: 'Aligned by schema', Icon: LayoutGrid },
];

const DETAIL_OPTIONS = [
  { value: 'full', label: 'All Columns', desc: 'Full fields & types', Icon: Rows3 },
  { value: 'keys', label: 'Keys Only', desc: 'PK, FK & UK only', Icon: KeyRound },
  { value: 'compact', label: 'Compact', desc: 'Table cards only', Icon: Square },
];

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
  const currentLayout = LAYOUT_OPTIONS.find((o) => o.value === algorithm) || LAYOUT_OPTIONS[0];
  const currentDetail = DETAIL_OPTIONS.find((o) => o.value === detailMode) || DETAIL_OPTIONS[0];

  return (
    <header className="z-30 flex h-15 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-md">
      {/* Left group */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex select-none items-center gap-2.5 border-r border-border pr-3.5">
          <motion.div
            whileHover={{ scale: 1.1, rotate: -8 }}
            whileTap={{ scale: 0.88, rotate: 6 }}
            transition={{ type: 'spring', stiffness: 520, damping: 18 }}
            className="flex h-8.5 w-8.5 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(0,0,0,0.16)]"
            title="Schemata — Offline SQL to ERD"
          >
            <SchemataLogo />
          </motion.div>
          <div className="hidden flex-col lg:flex">
            <span className="whitespace-nowrap text-[15px] font-bold leading-none tracking-tight">
              Schemata
            </span>
            <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium leading-none text-muted-foreground">
              SQL → ERD
            </span>
          </div>
          <Badge
            variant="default"
            className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold xl:inline-flex"
            title="Runs 100% locally with zero internet access"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
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
              <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" id="samplesMenu" className="w-80">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Sample Schemas
            </div>
            {Object.entries(SAMPLE_PRESETS).map(([key, sample]) => (
              <DropdownMenuItem
                key={key}
                data-sample={key}
                onSelect={() => onSelectSample(key, sample)}
              >
                <span className="truncate font-medium">{sample.name}</span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
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
        {/* Custom Bouncy Layout Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="selectLayout" variant="outline" title="Layout Algorithm">
              <currentLayout.Icon className="opacity-75" />
              <span>{currentLayout.label}</span>
              <ChevronDown className="opacity-55" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Diagram Layout
            </div>
            {LAYOUT_OPTIONS.map((opt) => {
              const Icon = opt.Icon;
              const active = algorithm === opt.value;
              return (
                <DropdownMenuItem key={opt.value} onSelect={() => onChangeAlgorithm(opt.value)}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className={active ? 'font-bold' : 'font-medium'}>{opt.label}</span>
                      <span className="text-[10.5px] text-muted-foreground">{opt.desc}</span>
                    </div>
                  </div>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Custom Bouncy Detail Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="selectDetail" variant="outline" title="Table Card Detail Level">
              <currentDetail.Icon className="opacity-75" />
              <span>{currentDetail.label}</span>
              <ChevronDown className="opacity-55" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Card Detail
            </div>
            {DETAIL_OPTIONS.map((opt) => {
              const Icon = opt.Icon;
              const active = detailMode === opt.value;
              return (
                <DropdownMenuItem key={opt.value} onSelect={() => onChangeDetailMode(opt.value)}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className={active ? 'font-bold' : 'font-medium'}>{opt.label}</span>
                      <span className="text-[10.5px] text-muted-foreground">{opt.desc}</span>
                    </div>
                  </div>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

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

        <Separator orientation="vertical" className="mx-1 h-5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="btnExport" variant="outline">
              <Download />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Export Offline
            </div>
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
          title="Toggle Light / Dark Theme"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  );
}
