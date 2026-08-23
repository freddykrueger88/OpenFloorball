/**
 * Export Routes – Issue #15 (GIF), Issue #23 (MP4), Issue #24 (PDF)
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { startGifExport, startMp4Export, getExportStatus, downloadExport } from '../controllers/exportController.js';
import { exportPdf, exportGameReport } from '../controllers/pdfExportController.js';
import { createFrameShare } from '../controllers/shareController.js';
import { exportRosterStatsCsv, exportGamesCsv } from '../controllers/csvExportController.js';

const router = Router();

// Alle Export-Routen erfordern Authentifizierung
router.use(authenticate);

router.post('/gif',            startGifExport);
router.post('/mp4',            startMp4Export);
router.post('/pdf',            exportPdf);
router.post('/game-report',    exportGameReport);
// Statistik-Architektur Phase 7: CSV-Export (Datenportabilität, offenes
// Format, CLAUDE.md §5.3) – GET, da rein lesend, kein Body nötig.
router.get('/roster-stats.csv', exportRosterStatsCsv);
router.get('/games.csv',        exportGamesCsv);
router.get('/status/:id',      getExportStatus);
router.get('/download/:id',    downloadExport);
// Einzel-Frame-Share nutzt denselben Router wie GIF/MP4, weil hier bereits
// der erhöhte JSON-Body-Limit (50mb, für Base64-PNGs) auf /api/export gilt.
router.post('/frame-share',    createFrameShare);

export default router;
