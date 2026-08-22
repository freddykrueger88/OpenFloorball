/**
 * promptLoader – zentrale Prompt-Vorlagen statt im Code verstreut
 * (AI_SYSTEM.md §13). Einfacher String-Replace der `{{platzhalter}}`-
 * Syntax reicht für die Handvoll Variablen hier – kein Template-Engine-
 * Overhead nötig.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedTrainingTemplate = null;
let cachedTacticsTemplate = null;
let cachedAnalysisTemplate = null;
let cachedKnowledgeTemplate = null;
let cachedInsightsTemplate = null;

function renderTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

function loadTemplate(filename) {
  return readFileSync(path.join(__dirname, 'prompts', filename), 'utf-8');
}

export function renderTrainingPrompt(vars) {
  if (cachedTrainingTemplate === null) cachedTrainingTemplate = loadTemplate('training.md');
  return renderTemplate(cachedTrainingTemplate, vars);
}

export function renderTacticsPrompt(vars) {
  if (cachedTacticsTemplate === null) cachedTacticsTemplate = loadTemplate('tactics.md');
  return renderTemplate(cachedTacticsTemplate, vars);
}

export function renderAnalysisPrompt(vars) {
  if (cachedAnalysisTemplate === null) cachedAnalysisTemplate = loadTemplate('analysis.md');
  return renderTemplate(cachedAnalysisTemplate, vars);
}

export function renderKnowledgePrompt(vars) {
  if (cachedKnowledgeTemplate === null) cachedKnowledgeTemplate = loadTemplate('knowledge.md');
  return renderTemplate(cachedKnowledgeTemplate, vars);
}

// Statistik-Architektur Phase 9 (KI/ML-Grundlagen, Spiel-Insights)
export function renderInsightsPrompt(vars) {
  if (cachedInsightsTemplate === null) cachedInsightsTemplate = loadTemplate('insights.md');
  return renderTemplate(cachedInsightsTemplate, vars);
}
