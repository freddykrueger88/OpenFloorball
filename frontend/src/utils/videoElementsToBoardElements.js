/**
 * Rechnet Video-Zeichenelemente (Pixel-Koordinaten des Video-Containers,
 * siehe VideoAnnotationOverlay.jsx) proportional in Feld-Meter-Koordinaten
 * eines Taktik-Boards um ("Video → Taktik-Board"-Feature).
 *
 * Bewusst einfache Skalierung (Breite/Höhe getrennt, kein einheitlicher
 * Skalierungsfaktor) statt exaktem Seitenverhältnis-Erhalt – das Video hat
 * i.d.R. ein anderes Seitenverhältnis als das Spielfeld, eine 1:1-Übernahme
 * der relativen Position ist hier wichtiger als geometrische Verzerrung.
 */
export function videoElementsToBoardElements(elements, containerSize, fieldDimensions) {
  if (!containerSize?.width || !containerSize?.height) return [];
  const scaleX = fieldDimensions.width / containerSize.width;
  const scaleY = fieldDimensions.height / containerSize.height;

  return (elements ?? []).map((el) => {
    const scaled = { ...el };
    if (Array.isArray(el.points)) {
      scaled.points = el.points.map((v, i) => (i % 2 === 0 ? v * scaleX : v * scaleY));
    }
    if (typeof el.x1 === 'number') scaled.x1 = el.x1 * scaleX;
    if (typeof el.y1 === 'number') scaled.y1 = el.y1 * scaleY;
    if (typeof el.x2 === 'number') scaled.x2 = el.x2 * scaleX;
    if (typeof el.y2 === 'number') scaled.y2 = el.y2 * scaleY;
    return scaled;
  });
}
