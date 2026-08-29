import { describe, it, expect } from 'vitest';
import { buildOsmEmbedUrl, buildOsmDirectionsUrl, buildOsmSearchUrl, buildRouteLink } from './osmLink.js';

describe('osmLink', () => {
  it('baut eine Embed-URL mit Bounding-Box und Marker', () => {
    const url = buildOsmEmbedUrl(52.5, 13.4);
    expect(url).toContain('openstreetmap.org/export/embed.html');
    expect(url).toContain('marker=52.5%2C13.4');
  });

  it('baut eine Directions-URL', () => {
    expect(buildOsmDirectionsUrl(52.5, 13.4)).toContain('directions?engine=');
  });

  it('kodiert die Suchanfrage für die Adress-Suche', () => {
    expect(buildOsmSearchUrl('Musterstraße 1, Musterstadt')).toContain(encodeURIComponent('Musterstraße 1, Musterstadt'));
  });

  describe('buildRouteLink', () => {
    it('bevorzugt Koordinaten, wenn vorhanden', () => {
      const url = buildRouteLink({ venueLat: 52.5, venueLng: 13.4, venueAddress: 'Adr' });
      expect(url).toContain('directions?');
    });

    it('fällt auf eine Adress-Suche zurück, wenn keine Koordinaten vorhanden sind', () => {
      const url = buildRouteLink({ venueName: 'Halle', venueAddress: 'Adr 1' });
      expect(url).toContain('search?query=');
    });

    it('gibt null zurück, wenn weder Koordinaten noch Adresse/Name vorhanden sind', () => {
      expect(buildRouteLink({})).toBeNull();
    });
  });
});
