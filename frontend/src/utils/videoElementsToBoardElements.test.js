import { describe, it, expect } from 'vitest';
import { videoElementsToBoardElements } from './videoElementsToBoardElements.js';

describe('videoElementsToBoardElements', () => {
  it('rechnet x1/y1/x2/y2 proportional von Container-Pixeln in Feld-Meter um', () => {
    const elements = [{ id: 'a', type: 'arrow', x1: 100, y1: 50, x2: 200, y2: 100, color: '#fff', strokeWidth: 3 }];
    const result = videoElementsToBoardElements(elements, { width: 400, height: 200 }, { width: 40, height: 20 });
    expect(result).toEqual([{ id: 'a', type: 'arrow', x1: 10, y1: 5, x2: 20, y2: 10, color: '#fff', strokeWidth: 3 }]);
  });

  it('rechnet points-Arrays (Freihand) paarweise um', () => {
    const elements = [{ id: 'b', type: 'freehand', points: [0, 0, 400, 200], color: '#000', strokeWidth: 2 }];
    const result = videoElementsToBoardElements(elements, { width: 400, height: 200 }, { width: 40, height: 20 });
    expect(result[0].points).toEqual([0, 0, 40, 20]);
  });

  it('verarbeitet mehrere Elemente unabhängig voneinander', () => {
    const elements = [
      { id: 'a', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100, color: '#fff', strokeWidth: 1 },
      { id: 'b', type: 'freehand', points: [200, 100], color: '#000', strokeWidth: 1 },
    ];
    const result = videoElementsToBoardElements(elements, { width: 400, height: 200 }, { width: 40, height: 20 });
    expect(result).toHaveLength(2);
    expect(result[0].x2).toBe(10);
    expect(result[1].points).toEqual([20, 10]);
  });

  it('gibt ein leeres Array für ein leeres Elemente-Array zurück', () => {
    expect(videoElementsToBoardElements([], { width: 400, height: 200 }, { width: 40, height: 20 })).toEqual([]);
  });

  it('gibt ein leeres Array zurück, wenn die Container-Größe (noch) 0 ist statt durch Null zu teilen', () => {
    const elements = [{ id: 'a', type: 'line', x1: 10, y1: 10, x2: 20, y2: 20 }];
    expect(videoElementsToBoardElements(elements, { width: 0, height: 0 }, { width: 40, height: 20 })).toEqual([]);
  });

  it('behält color/strokeWidth/type/id/dash/arrowHead unverändert bei', () => {
    const elements = [{ id: 'c', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100, color: '#f00', strokeWidth: 4, dash: [5, 5], arrowHead: true }];
    const result = videoElementsToBoardElements(elements, { width: 400, height: 200 }, { width: 40, height: 20 });
    expect(result[0]).toMatchObject({ id: 'c', type: 'arrow', color: '#f00', strokeWidth: 4, dash: [5, 5], arrowHead: true });
  });
});
