import React from 'react';
import { Copy, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ExportModal({ exportData, onClose, onCopy, onDownload }) {
  return (
    <Dialog open={Boolean(exportData)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent id="exportModal">
        <DialogHeader>
          <DialogTitle id="modalTitle">{exportData?.title || 'Export Preview'}</DialogTitle>
          <DialogDescription>
            Generated 100% offline — copy or download as {exportData?.filename}
          </DialogDescription>
        </DialogHeader>
        <pre
          id="modalCode"
          className="m-0 max-h-[58vh] flex-1 overflow-auto bg-background p-4 font-mono text-xs leading-relaxed text-foreground"
        >
          {exportData?.content || ''}
        </pre>
        <DialogFooter>
          <Button id="btnCopyExport" variant="outline" onClick={onCopy}>
            <Copy />
            Copy to Clipboard
          </Button>
          <Button id="btnDownloadExport" variant="default" onClick={onDownload}>
            <Download />
            Download File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
