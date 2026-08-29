/**
 * osmLink – kleine, abhängigkeitsfreie Helfer für OpenStreetMap-Links/-
 * Embeds (Spieler-Dashboard-Ausbau, VenueMapCard/NextMatchCard). Bewusst
 * kein Leaflet/react-leaflet – ein `<iframe>`-Embed plus Außenlinks decken
 * die Anforderung (Karte, Marker, Route, Attribution) ohne neue
 * Abhängigkeit ab, siehe Plan-ADR.
 */

export function buildOsmEmbedUrl(lat, lng, delta = 0.01) {
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function buildOsmDirectionsUrl(lat, lng) {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${lat}%2C${lng}`;
}

export function buildOsmSearchUrl(query) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

// Bevorzugt eine echte Route (Koordinaten vorhanden), sonst eine Adress-
// Suche, sonst null (kein Link anzeigen).
export function buildRouteLink({ venueLat, venueLng, venueAddress, venueName }) {
  if (venueLat != null && venueLng != null) return buildOsmDirectionsUrl(venueLat, venueLng);
  const query = [venueName, venueAddress].filter(Boolean).join(', ');
  return query ? buildOsmSearchUrl(query) : null;
}
