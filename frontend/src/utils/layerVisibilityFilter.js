/**
 * layerVisibilityFilter – reine Filterfunktion für die Session-Sichtbarkeit
 * (LayerVisibilityPanel.jsx, CLAUDE.md §10.2).
 *
 * ISSUE 031: Der Export-Renderpfad (BoardEditorPage.jsx::renderFrame) muss
 * exakt dieselben Spieler/Elemente ausblenden wie die Live-Anzeige, sonst
 * "lügt" der Export gegenüber dem Bildschirm. Diese Funktion spiegelt daher
 * bewusst 1:1 die Filterlogik aus PlayerLayer.jsx (Ball immer sichtbar,
 * sonst blendet p.visible===false ODER layerVisibility[team]===false aus)
 * und DrawingLayer.jsx (layerVisibility[el.type]===false blendet aus) –
 * als eigene, testbare Funktion statt die Logik nur inline in renderFrame
 * zu duplizieren.
 */
export function filterVisiblePlayers(players = [], layerVisibility = {}) {
  return players.filter((p) => {
    if (p.team === 'ball') return true;
    if (p.visible === false) return false;
    if (layerVisibility?.[p.team] === false) return false;
    return true;
  });
}

export function filterVisibleElements(elements = [], layerVisibility = {}) {
  return elements.filter((el) => layerVisibility?.[el.type] !== false);
}
