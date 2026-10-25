/**
 * OpenFloorball – Zentrale Fehlerbehandlung
 */
import logger from '../utils/logger.js';

/**
 * 404 Handler – Route nicht gefunden
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} existiert nicht.`,
    status: 404,
  });
};

/**
 * 500 Handler – Interne Serverfehler
 */
export const errorHandler = (err, req, res, _next) => {
  // Body-Parser-Limit (express.json): klare Meldung statt generischem 500.
  // Betrifft insbesondere große Board-/Frame-Saves (BOARD_JSON_LIMIT) und
  // andere JSON-Endpunkte.
  if (err.type === 'entity.too.large') {
    if (process.env.NODE_ENV !== 'test') {
      logger.warn(`[413] ${req.method} ${req.originalUrl}: Request-Body zu groß`);
    }
    return res.status(413).json({
      success: false,
      error: 'Anfrage zu groß',
      message: 'Die Anfrage ist zu groß. Bitte die Zeichnung verkleinern oder in mehrere Frames aufteilen.',
      status: 413,
    });
  }

  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  // Fehler loggen (nicht in Tests)
  if (process.env.NODE_ENV !== 'test') {
    logger.error(`[ERROR] ${status} ${req.method} ${req.originalUrl}:`, err.stack || err.message);
  }

  res.status(status).json({
    error: message,
    status,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
