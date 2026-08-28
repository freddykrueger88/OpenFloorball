/**
 * CommentPinsLayer – Kommentare mit Feld-Position als klickbare Pins
 * (Layer-System, CLAUDE.md §10.2). Rendert nur Kommentare mit gesetztem
 * x/y (siehe commentsController.js) – normale, nicht angepinnte
 * Kommentare tauchen hier gar nicht auf, nur in CommentsPanel.jsx.
 *
 * Bewusst eine reine Anzeige-/Klick-Komponente ohne eigene Text-UI: ein
 * Klick auf einen Pin öffnet den bestehenden Kommentare-Tab (siehe
 * BoardEditorPage.jsx `onPinClick`), statt eine zweite
 * Kommentar-Oberfläche auf dem Canvas nachzubauen.
 */
import { Layer, Group, Circle, Text } from 'react-konva';

export default function CommentPinsLayer({
  comments = [],
  scale,
  offsetX,
  offsetY,
  onPinClick,
  visible = true,
}) {
  if (!visible) return null;

  const pins = comments.filter((c) => c.x != null && c.y != null);
  const toCanvasX = (m) => offsetX + m * scale;
  const toCanvasY = (m) => offsetY + m * scale;

  return (
    <Layer>
      {pins.map((c) => (
        <Group
          key={c._id}
          x={toCanvasX(c.x)}
          y={toCanvasY(c.y)}
          onClick={() => onPinClick?.(c._id)}
          onTap={() => onPinClick?.(c._id)}
          onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'pointer'; }}
          onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default'; }}
        >
          <Circle radius={13} fill="#facc15" stroke="#78350f" strokeWidth={1.5} shadowColor="#000" shadowBlur={4} shadowOpacity={0.3} />
          <Text text="💬" fontSize={14} offsetX={7} offsetY={8} listening={false} />
        </Group>
      ))}
    </Layer>
  );
}
