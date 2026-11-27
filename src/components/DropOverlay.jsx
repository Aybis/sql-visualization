import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';

export default function DropOverlay({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          id="dropOverlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
        >
          <motion.div
            initial={{ scale: 0.88, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 440, damping: 22 }}
            className="rounded-3xl border-2 border-dashed border-primary bg-card px-12 py-10 text-center shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md"
            >
              <Upload className="h-5 w-5" />
            </motion.div>
            <h2 className="text-base font-bold tracking-tight">Drop your .sql file to visualize</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Parsed 100% offline inside your browser — no data ever leaves your device.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
