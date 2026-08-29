/**
 * demoDataController – Status/Erzeugen/Löschen der pro Account isolierten
 * Demo-Testumgebung (Onboarding-Ausbau, siehe services/demoData.js).
 */
import { getDemoDataStatus, createDemoDataForUser, deleteDemoDataForUser } from '../services/demoData.js';
import { success, created, error } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

function toApiStatus(status) {
  return { hasDemoData: status.hasDemoData, seededAt: status.seededAt };
}

// GET /api/demo-data
export async function getStatus(req, res) {
  try {
    res.json(success(toApiStatus(await getDemoDataStatus(req.user.id))));
  } catch (err) {
    logger.error('[getDemoDataStatus]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/demo-data – idempotent, 201 auch wenn bereits vorhanden.
export async function createDemoData(req, res) {
  try {
    res.status(201).json(created(toApiStatus(await createDemoDataForUser(req.user.id))));
  } catch (err) {
    logger.error('[createDemoData]', err);
    res.status(500).json(error('Demo-Daten konnten nicht erzeugt werden'));
  }
}

// DELETE /api/demo-data
export async function deleteDemoData(req, res) {
  try {
    res.json(success(toApiStatus(await deleteDemoDataForUser(req.user.id))));
  } catch (err) {
    logger.error('[deleteDemoData]', err);
    res.status(500).json(error('Demo-Daten konnten nicht gelöscht werden'));
  }
}
