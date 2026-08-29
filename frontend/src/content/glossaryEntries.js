/**
 * glossaryEntries – Inhalte des Floorball-Lexikons (Onboarding-Ausbau).
 *
 * Bewusst eine statische Content-Datei statt einer DB-Tabelle: Begriffe
 * sind global (nicht nutzer-/team-gebunden), ändern sich selten und sollen
 * per PR erweiterbar bleiben (CLAUDE.md §5.4 Open Source First) – analog zu
 * RulesPage.jsx/constants/positionHints.js, nicht zur Library (das ist
 * echter, nutzergenerierter Inhalt und braucht deshalb eine Tabelle).
 *
 * Struktur ist pro Locale erweiterbar: `getGlossaryEntries(locale)` fällt
 * bis zu einer eigenen `en`/`sv`-Übersetzung auf `de` zurück (i18next selbst
 * wird für die Fließtexte bewusst nicht genutzt, siehe Plan/ADR im
 * Abschlussbericht – nur UI-Strings wie Kategorienamen liegen in den
 * normalen de.json/en.json/sv.json unter dem "glossary"-Namespace).
 *
 * Um einen Begriff zu ergänzen: einfach ein neues Objekt mit eindeutigem
 * `slug` an GLOSSARY_ENTRIES_DE anhängen. `related` verweist auf Slugs
 * anderer Einträge für Querverweise in der Detailansicht.
 */
import { POSITION_HINTS } from '../constants/positionHints.js';

function positionEntry(roleKey, { slug, term, synonyms, cooperation, beginnerTip, related }) {
  const hint = POSITION_HINTS.de[roleKey];
  return {
    slug,
    category: 'positionen',
    term,
    synonyms,
    summary: hint.hint,
    body: [
      hint.hint,
      `Wichtige Fähigkeiten: ${hint.tips.join('; ')}.`,
      `Zusammenarbeit: ${cooperation}`,
      `Für Einsteiger: ${beginnerTip}`,
    ],
    related,
  };
}

export const GLOSSARY_ENTRIES_DE = [
  // ── Positionen ─────────────────────────────────────────────────────
  positionEntry('TW', {
    slug: 'torhueter',
    term: 'Torhüter',
    synonyms: ['Goalie', 'Keeper', 'TW'],
    cooperation: 'Steuert die Verteidiger durch Zurufe und organisiert den Rückraum, damit Schusswege früh geschlossen werden.',
    beginnerTip: 'Ruhig bleiben und laut kommunizieren ist wichtiger als spektakuläre Paraden.',
    related: ['verteidiger', 'save', 'torraum'],
  }),
  positionEntry('V', {
    slug: 'verteidiger',
    term: 'Verteidiger',
    synonyms: ['Defender', 'Abwehrspieler'],
    cooperation: 'Bildet meist ein Verteidigerpaar und stimmt sich eng mit dem Torhüter sowie dem Center ab.',
    beginnerTip: 'Lieber die eigene Position halten als jedem Gegenspieler hinterherlaufen.',
    related: ['torhueter', 'wechselblock', 'defensive-grundordnung'],
  }),
  positionEntry('C', {
    slug: 'center',
    term: 'Center',
    synonyms: ['Mittelspieler'],
    cooperation: 'Verbindet Abwehr und Angriff und unterstützt situativ sowohl Verteidiger als auch Stürmer.',
    beginnerTip: 'Viel Laufarbeit einplanen – der Center ist selten im Stillstand.',
    related: ['stuermer', 'verteidiger', 'umschaltspiel'],
  }),
  positionEntry('S', {
    slug: 'stuermer',
    term: 'Stürmer',
    synonyms: ['Flügelspieler', 'linker Flügel', 'rechter Flügel', 'Angreifer'],
    cooperation: 'Spielt meist auf einer festen Seite (links/rechts) und öffnet durch Laufwege Räume für den Center.',
    beginnerTip: 'Frühzeitig eine gute Schussposition suchen, statt den Ball ständig selbst zu fordern.',
    related: ['center', 'offensive-grundordnung', 'direktschuss'],
  }),
  {
    slug: 'kapitaen',
    category: 'positionen',
    term: 'Kapitän',
    synonyms: ['Captain', 'Mannschaftsführer'],
    summary: 'Sprachrohr der Mannschaft gegenüber Schiedsrichtern und Trainerteam.',
    body: [
      'Der Kapitän (erkennbar an einem „C“ auf dem Trikot) ist die einzige Person, die während des Spiels mit den Schiedsrichtern über Regelfragen sprechen darf.',
      'Daneben hat die Rolle vor allem eine Vorbildfunktion innerhalb der Mannschaft – fachlich unterscheidet sie sich nicht von einer normalen Feldspieler-Position.',
      'Für Einsteiger: Die Kapitänsbinde ist keine taktische Position, sondern eine zusätzliche Verantwortung on top.',
    ],
    related: ['torhueter'],
  },
  {
    slug: 'ersatzspieler',
    category: 'positionen',
    term: 'Ersatzspieler',
    synonyms: ['Wechselspieler', 'Auswechselspieler'],
    summary: 'Spieler auf der Wechselbank, der über fliegende Wechsel eingesetzt wird.',
    body: [
      'Anders als in vielen anderen Sportarten gibt es im Floorball keine festen Auswechselzeiten – Ersatzspieler kommen laufend über den fliegenden Wechsel ins Spiel.',
      'Ein Kader ist meist in mehrere Wechselblöcke aufgeteilt, sodass jede Spielerin und jeder Spieler regelmäßig kurze, intensive Einsatzzeiten bekommt.',
      'Für Einsteiger: Auf der Bank sitzen heißt beim Floorball nicht "nicht im Spiel" – der nächste Wechsel kommt oft nach wenigen Sekunden.',
    ],
    related: ['wechsel', 'fliegender-wechsel', 'wechselblock'],
  },

  // ── Grundbegriffe ──────────────────────────────────────────────────
  {
    slug: 'torraum',
    category: 'grundbegriffe',
    term: 'Torraum',
    synonyms: ['Crease', 'Torraumlinie'],
    summary: 'Markierter Bereich vor dem Tor, den nur der Torhüter betreten darf.',
    body: [
      'Der Torraum ist die halbrunde Fläche vor dem Tor. Nur der Torhüter darf sich darin aufhalten – Feldspieler beider Teams müssen außerhalb bleiben, auch wenn der Ball hineinrollt.',
      'Ein Tor, das erzielt wird, während sich ein Feldspieler im Torraum befindet oder ihn berührt, kann aberkannt werden.',
    ],
    related: ['torhueter', 'save'],
  },
  {
    slug: 'ueberzahl',
    category: 'grundbegriffe',
    term: 'Überzahl',
    synonyms: ['Mehr gegen weniger', 'Powerplay-Situation'],
    summary: 'Eine Mannschaft hat wegen einer Zeitstrafe des Gegners mehr Feldspieler im Einsatz.',
    body: [
      'Überzahl entsteht, wenn ein Team wegen einer Zeitstrafe gegen den Gegner vorübergehend mehr Feldspieler einsetzen darf, zum Beispiel 5 gegen 4.',
      'Die taktische Nutzung dieser Situation nennt sich Powerplay.',
    ],
    related: ['unterzahl', 'zeitstrafe', 'powerplay'],
  },
  {
    slug: 'unterzahl',
    category: 'grundbegriffe',
    term: 'Unterzahl',
    synonyms: ['Weniger gegen mehr'],
    summary: 'Eine Mannschaft hat wegen einer eigenen Zeitstrafe vorübergehend weniger Feldspieler im Einsatz.',
    body: [
      'Unterzahl ist die Gegensituation zur Überzahl: Ein Team muss wegen einer eigenen Zeitstrafe vorübergehend mit weniger Feldspielern auskommen.',
      'Das defensive Verhalten in dieser Situation nennt sich Boxplay.',
    ],
    related: ['ueberzahl', 'zeitstrafe', 'boxplay'],
  },
  {
    slug: 'bully',
    category: 'regeln',
    term: 'Bully',
    synonyms: ['Face-off', 'Anspiel'],
    summary: 'Spieleröffnung, bei der zwei Gegenspieler gleichzeitig um den am Boden liegenden Ball kämpfen.',
    body: [
      'Beim Bully legt der Schiedsrichter den Ball zwischen die Schlägerblätter zweier gegnerischer Spieler, die sich gegenüberstehen. Auf ein Zeichen hin dürfen beide den Ball spielen.',
      'Ein Bully eröffnet das Spiel (Anstoß), setzt es nach einer Unterbrechung fort oder folgt auf ein Tor.',
    ],
    related: ['spielaufbau'],
  },
  {
    slug: 'freischlag',
    category: 'regeln',
    term: 'Freischlag',
    synonyms: ['Free hit'],
    summary: 'Ungestörter Schlag/Schuss nach einem Regelverstoß des Gegners.',
    body: [
      'Nach bestimmten Regelverstößen (z. B. hoher Stock, Halten) erhält die gegnerische Mannschaft einen Freischlag an der Stelle des Vergehens.',
      'Gegenspieler müssen dabei mindestens drei Meter Abstand halten, bis der Ball gespielt wurde.',
    ],
    related: ['strafstoss'],
  },
  {
    slug: 'einschlag',
    category: 'regeln',
    term: 'Einschlag',
    synonyms: ['Einwurf-Äquivalent'],
    summary: 'Spielfortsetzung von der Bande, nachdem der Ball die Seitenauslinie überquert hat.',
    body: [
      'Verlässt der Ball das Feld über die Seitenbande, wird das Spiel mit einem Einschlag von der Stelle fortgesetzt, an der der Ball die Linie überquert hat.',
    ],
    related: ['ausball', 'bande'],
  },
  {
    slug: 'ausball',
    category: 'regeln',
    term: 'Ausball',
    synonyms: ['Ball im Aus'],
    summary: 'Der Ball hat das Spielfeld über die Bande verlassen.',
    body: [
      'Fliegt oder rollt der Ball über die Bande hinaus, ist er im Aus. Das Spiel wird per Einschlag fortgesetzt.',
    ],
    related: ['einschlag', 'bande'],
  },
  {
    slug: 'strafstoss',
    category: 'regeln',
    term: 'Strafstoß',
    synonyms: ['Penalty', '7-Meter-Äquivalent'],
    summary: 'Schuss allein gegen den Torhüter nach einem schweren Regelverstoß oder einer klaren Torchancenverhinderung.',
    body: [
      'Ein Strafstoß wird verhängt, wenn eine klare Torchance regelwidrig verhindert wird, zum Beispiel durch ein Foul im Torraum-Umfeld.',
      'Der schießende Spieler tritt dabei allein gegen den gegnerischen Torhüter an.',
    ],
    related: ['freischlag', 'save'],
  },
  {
    slug: 'zeitstrafe',
    category: 'regeln',
    term: 'Zeitstrafe',
    synonyms: ['2-Minuten-Strafe', '5-Minuten-Strafe'],
    summary: 'Ein Spieler muss für 2 oder 5 Minuten auf die Strafbank, sein Team spielt in Unterzahl.',
    body: [
      'Bei Regelverstößen wie Halten, Beinstellen oder unsportlichem Verhalten wird eine Zeitstrafe von meist 2, bei schwereren Vergehen 5 Minuten verhängt.',
      'Das bestrafte Team spielt für diese Zeit in Unterzahl, sofern der Gegner nicht selbst ein Tor kassiert und die Strafe dadurch (bei 2 Minuten) vorzeitig endet.',
    ],
    related: ['unterzahl', 'matchstrafe'],
  },
  {
    slug: 'matchstrafe',
    category: 'regeln',
    term: 'Matchstrafe',
    synonyms: ['Spieldauerdisziplinarstrafe'],
    summary: 'Härteste Strafe: Der Spieler muss das restliche Spiel vom Feld, meist mit zusätzlicher Sperre.',
    body: [
      'Bei besonders schweren oder wiederholten Regelverstößen wird eine Matchstrafe verhängt – der betroffene Spieler darf für den Rest der Partie nicht mehr mitwirken.',
      'Häufig zieht eine Matchstrafe zusätzlich eine Sperre für kommende Spiele nach sich, über die der Verband entscheidet.',
    ],
    related: ['zeitstrafe'],
  },
  {
    slug: 'passweg',
    category: 'grundbegriffe',
    term: 'Passweg',
    synonyms: ['Zuspielweg'],
    summary: 'Die gedachte Linie, auf der ein Pass von einem Spieler zum anderen läuft.',
    body: [
      'Ein Passweg ist die freie Bahn zwischen zwei Mitspielern, über die der Ball zugespielt werden kann. Verteidiger versuchen, wichtige Passwege zu blockieren, statt ausschließlich den Ball zu jagen.',
    ],
    related: ['spielaufbau', 'pass-und-laufwege'],
  },
  {
    slug: 'slot',
    category: 'grundbegriffe',
    term: 'Slot',
    synonyms: ['Bullyraum', 'Zentrum vor dem Tor'],
    summary: 'Zentraler, gefährlicher Bereich direkt vor dem gegnerischen Tor.',
    body: [
      'Der Slot ist der Raum unmittelbar vor dem Tor, aus dem heraus Torschüsse besonders gefährlich sind. Offensive Systeme versuchen, Mitspieler gezielt in den Slot zu bringen.',
    ],
    related: ['offensive-grundordnung', 'direktschuss'],
  },
  {
    slug: 'bande',
    category: 'grundbegriffe',
    term: 'Bande',
    synonyms: ['Spielfeldbande'],
    summary: 'Die feste Umrandung des Spielfelds, von der der Ball ins Spiel zurückspringen kann.',
    body: [
      'Die Bande umgibt das gesamte Spielfeld und ist Teil des Spiels: Der Ball darf von ihr abprallen und bleibt im Spiel, solange er innerhalb der Markierungen bleibt.',
    ],
    related: ['ausball', 'einschlag'],
  },
  {
    slug: 'schlaegerblatt',
    category: 'grundbegriffe',
    term: 'Schlägerblatt',
    synonyms: ['Kelle', 'Blade'],
    summary: 'Der gebogene Teil des Floorballschlägers, mit dem der Ball geführt und geschossen wird.',
    body: [
      'Das Schlägerblatt ist der flache, leicht gebogene Teil am Ende des Stocks. Seine Form beeinflusst Ballkontrolle, Schusskraft und Präzision beim Schlenzer.',
    ],
    related: ['stockhandling', 'schuss'],
  },
  {
    slug: 'stockhandling',
    category: 'grundbegriffe',
    term: 'Stockhandling',
    synonyms: ['Stickhandling', 'Schlägerführung'],
    summary: 'Die Fähigkeit, den Ball unter Kontrolle am Schläger zu führen.',
    body: [
      'Stockhandling beschreibt die technische Fertigkeit, den Ball eng am Schlägerblatt zu führen, ihn schnell von einer Seite zur anderen zu bewegen und dabei die Kontrolle unter Druck zu behalten.',
    ],
    related: ['dribbling', 'schlaegerblatt'],
  },
  {
    slug: 'dribbling',
    category: 'grundbegriffe',
    term: 'Dribbling',
    synonyms: ['Alleingang'],
    summary: 'Der Ball wird im Lauf am Schläger geführt, um einen Gegenspieler zu überspielen.',
    body: [
      'Beim Dribbling führt eine Spielerin oder ein Spieler den Ball im Lauf eng am Schlägerblatt, meist um direkt einen Gegenspieler zu überspielen, statt zu passen.',
    ],
    related: ['stockhandling'],
  },
  {
    slug: 'schuss',
    category: 'grundbegriffe',
    term: 'Schuss',
    synonyms: ['Torschuss'],
    summary: 'Der Ball wird mit Schwung Richtung Tor gespielt.',
    body: [
      'Ein Schuss ist jeder gezielte, kraftvolle Torabschluss. Gängige Schusstechniken sind unter anderem der Schlenzer und der Direktschuss.',
    ],
    related: ['schlenzer', 'direktschuss', 'save'],
  },
  {
    slug: 'schlenzer',
    category: 'grundbegriffe',
    term: 'Schlenzer',
    synonyms: ['Wrist Shot'],
    summary: 'Schusstechnik mit Handgelenkeinsatz, bei der der Ball erst kurz vor dem Abschluss beschleunigt wird.',
    body: [
      'Beim Schlenzer bleibt der Ball länger am Schläger als beim Direktschuss und wird erst kurz vor dem Loslassen durch Handgelenk und Unterarm beschleunigt – das macht die Schussrichtung schwer vorhersehbar.',
    ],
    related: ['schuss', 'direktschuss'],
  },
  {
    slug: 'direktschuss',
    category: 'grundbegriffe',
    term: 'Direktschuss',
    synonyms: ['One-Timer'],
    summary: 'Der Ball wird direkt aus einem Zuspiel heraus abgeschlossen, ohne ihn vorher anzunehmen.',
    body: [
      'Ein Direktschuss (One-Timer) wird sofort aus dem Pass heraus geschossen, ohne den Ball vorher zu kontrollieren. Das ist schwer zu treffen, aber für den Torhüter besonders schwer zu antizipieren.',
    ],
    related: ['schuss', 'slot'],
  },
  {
    slug: 'block',
    category: 'grundbegriffe',
    term: 'Block',
    synonyms: ['Schussblock'],
    summary: 'Ein Torschuss wird durch den Körper oder Schläger eines Verteidigers gestoppt, bevor er das Tor erreicht.',
    body: [
      'Ein Block liegt vor, wenn ein Feldspieler einen gegnerischen Torschuss mit Körper oder Schläger abfängt, bevor er auf den Torhüter oder ins Tor trifft.',
    ],
    related: ['verteidiger', 'boxplay'],
  },
  {
    slug: 'save',
    category: 'grundbegriffe',
    term: 'Save',
    synonyms: ['Parade'],
    summary: 'Der Torhüter wehrt einen Torschuss ab.',
    body: [
      'Ein Save ist jede erfolgreiche Abwehraktion des Torhüters gegen einen Torschuss – mit Schoner, Handschuh, Fanghandschuh, Bein oder Körper.',
    ],
    related: ['torhueter', 'schuss'],
  },
  {
    slug: 'wechsel',
    category: 'grundbegriffe',
    term: 'Wechsel',
    synonyms: ['Auswechslung'],
    summary: 'Ein Spieler verlässt das Feld, ein anderer kommt an gleicher Stelle ins Spiel.',
    body: [
      'Ein Wechsel findet statt, wenn ein Feldspieler das Spiel verlässt und ein Mitspieler an derselben Stelle über die Wechselzone einwechselt – meist alle 30-60 Sekunden, um die Intensität hochzuhalten.',
    ],
    related: ['fliegender-wechsel', 'wechselblock'],
  },
  {
    slug: 'fliegender-wechsel',
    category: 'grundbegriffe',
    term: 'Fliegender Wechsel',
    synonyms: ['Wechsel im laufenden Spiel'],
    summary: 'Der Wechsel erfolgt, während der Ball weiter im Spiel ist, nicht bei einer Unterbrechung.',
    body: [
      'Anders als etwa im Fußball läuft das Spiel beim fliegenden Wechsel einfach weiter – Ein- und Aussteigende müssen sich deshalb eng abstimmen, damit kurzzeitig keine Lücke im System entsteht.',
    ],
    related: ['wechsel', 'wechselblock'],
  },
  {
    slug: 'pressing',
    category: 'taktik',
    term: 'Pressing',
    synonyms: ['Anlaufen', 'Druck ausüben'],
    summary: 'Aktives, frühes Attackieren des ballführenden Gegners, um Fehler zu erzwingen.',
    body: [
      'Beim Pressing wird der Ballführer früh und konsequent unter Druck gesetzt, um Zeit und Raum zu nehmen und Ballverluste des Gegners zu provozieren.',
      'Pressing lässt sich in unterschiedlicher Intensität und ab unterschiedlichen Feldzonen spielen (High Press, Mid Press, Low Block).',
    ],
    related: ['forechecking', 'konter'],
  },
  {
    slug: 'forechecking',
    category: 'taktik',
    term: 'Forechecking',
    synonyms: ['Angriffspressing'],
    summary: 'Pressing bereits im gegnerischen Drittel, direkt nach Ballverlust oder beim gegnerischen Spielaufbau.',
    body: [
      'Forechecking beschreibt organisiertes Pressing im gegnerischen Drittel, meist über feste Laufwege der Stürmer (z. B. Systeme wie 2-1-2 oder 1-2-2), um den gegnerischen Spielaufbau schon früh zu stören.',
    ],
    related: ['pressing', 'defensive-grundordnung'],
  },
  {
    slug: 'konter',
    category: 'taktik',
    term: 'Konter',
    synonyms: ['Gegenangriff'],
    summary: 'Schneller Umschaltmoment von der eigenen Verteidigung in einen Angriff nach Ballgewinn.',
    body: [
      'Ein Konter nutzt den Moment direkt nach einem Ballgewinn, in dem der Gegner noch nicht wieder geordnet steht, für einen schnellen eigenen Angriff.',
    ],
    related: ['umschaltspiel', 'spielaufbau'],
  },
  {
    slug: 'spielaufbau',
    category: 'taktik',
    term: 'Spielaufbau',
    synonyms: ['Ballbesitzspiel von hinten'],
    summary: 'Kontrolliertes Vorspielen des Balls aus der eigenen Zone heraus.',
    body: [
      'Der Spielaufbau beschreibt, wie ein Team den Ball aus der eigenen Verteidigungszone kontrolliert nach vorne bringt, statt ihn planlos wegzuschlagen.',
    ],
    related: ['passweg', 'umschaltspiel'],
  },
  {
    slug: 'mannorientierte-verteidigung',
    category: 'taktik',
    term: 'Mannorientierte Verteidigung',
    synonyms: ['Manndeckung'],
    summary: 'Jeder Verteidiger ist für einen bestimmten Gegenspieler zuständig, unabhängig von dessen Position auf dem Feld.',
    body: [
      'Bei mannorientierter Verteidigung folgt jeder Feldspieler seinem zugeteilten Gegenspieler über weite Teile des Feldes, statt nur einen festen Raum zu sichern.',
    ],
    related: ['raumdeckung', 'defensive-grundordnung'],
  },
  {
    slug: 'raumdeckung',
    category: 'taktik',
    term: 'Raumdeckung',
    synonyms: ['Zonendeckung'],
    summary: 'Jeder Spieler sichert einen festen Bereich des Feldes statt eines bestimmten Gegners.',
    body: [
      'Bei Raumdeckung ist jeder Verteidiger für eine feste Zone zuständig und übernimmt jeden Gegenspieler, der diese Zone betritt – anders als bei mannorientierter Verteidigung.',
    ],
    related: ['mannorientierte-verteidigung', 'boxplay'],
  },
  {
    slug: 'defensive-grundordnung',
    category: 'taktik',
    term: 'Defensive Grundordnung',
    synonyms: ['Abwehrsystem'],
    summary: 'Das grundlegende Positionsgefüge einer Mannschaft ohne Ballbesitz.',
    body: [
      'Die defensive Grundordnung legt fest, wie sich ein Team ohne Ball auf dem Feld positioniert, um Passwege zu schließen und Schüsse zu verhindern.',
    ],
    related: ['offensive-grundordnung', 'raumdeckung'],
  },
  {
    slug: 'offensive-grundordnung',
    category: 'taktik',
    term: 'Offensive Grundordnung',
    synonyms: ['Angriffssystem'],
    summary: 'Das grundlegende Positionsgefüge einer Mannschaft mit Ballbesitz.',
    body: [
      'Die offensive Grundordnung beschreibt, wie sich ein Team mit Ball positioniert, um Räume zu öffnen, Passwege anzubieten und Torchancen zu erarbeiten – im Floorball meist im 2-1-2-System.',
    ],
    related: ['defensive-grundordnung', 'slot'],
  },
  {
    slug: 'umschaltspiel',
    category: 'taktik',
    term: 'Umschaltspiel',
    synonyms: ['Transition'],
    summary: 'Der schnelle Wechsel zwischen Verteidigung und Angriff (und umgekehrt) nach einem Ballwechsel.',
    body: [
      'Umschaltspiel beschreibt, wie schnell und geordnet eine Mannschaft nach einem Ballgewinn in den Angriff bzw. nach einem Ballverlust zurück in die Verteidigung findet.',
    ],
    related: ['konter', 'spielaufbau'],
  },
  {
    slug: 'ueberzahlspiel',
    category: 'taktik',
    term: 'Überzahlspiel',
    synonyms: ['Powerplay-Taktik'],
    summary: 'Die taktische Ausnutzung einer Überzahl-Situation, meist mit fester Aufstellung.',
    body: [
      'Im Überzahlspiel nutzt ein Team die zusätzliche Spielerin bzw. den zusätzlichen Spieler für feste Aufstellungen und Passmuster (Powerplay), um gezielt Torchancen im Slot zu erarbeiten.',
    ],
    related: ['powerplay', 'ueberzahl'],
  },
  {
    slug: 'unterzahlspiel',
    category: 'taktik',
    term: 'Unterzahlspiel',
    synonyms: ['Boxplay-Taktik'],
    summary: 'Das organisierte defensive Verhalten in Unterzahl, meist mit fester Formation.',
    body: [
      'Im Unterzahlspiel verteidigt ein Team mit einer Spielerin bzw. einem Spieler weniger in einer festen Formation (Boxplay), um Passwege zu blockieren und hochwertige Schüsse zu verhindern.',
    ],
    related: ['boxplay', 'unterzahl'],
  },
  {
    slug: 'pass-und-laufwege',
    category: 'taktik',
    term: 'Pass- und Laufwege',
    synonyms: ['Laufmuster'],
    summary: 'Die abgestimmten Bewegungs- und Zuspielmuster einer Mannschaft im Angriff.',
    body: [
      'Pass- und Laufwege beschreiben, wie sich Spieler ohne Ball bewegen, um Passoptionen anzubieten und Räume zu öffnen – zentraler Trainingsinhalt für ein funktionierendes Offensivsystem.',
    ],
    related: ['passweg', 'offensive-grundordnung'],
  },
  {
    slug: 'kommunikation-auf-dem-feld',
    category: 'taktik',
    term: 'Kommunikation auf dem Feld',
    synonyms: ['Zurufe', 'Coaching auf dem Feld'],
    summary: 'Verbale Absprachen zwischen Mitspielern während des Spiels.',
    body: [
      'Klare, kurze Zurufe (z. B. "Mann frei", "Druck", "Wechsel") helfen der Mannschaft, sich ohne Zeitverlust neu zu ordnen – besonders in der Verteidigung und beim fliegenden Wechsel.',
    ],
    related: ['fliegender-wechsel', 'mannorientierte-verteidigung'],
  },
  {
    slug: 'powerplay',
    category: 'grundbegriffe',
    term: 'Powerplay',
    synonyms: ['5-gegen-4', '5-gegen-3'],
    summary: 'Der gebräuchliche Name für organisiertes Spiel in Überzahl.',
    body: [
      'Powerplay ist der übliche Begriff für das taktische Spiel in Überzahl, meist 5 gegen 4 oder 5 gegen 3. Details zur Ausführung siehe Überzahlspiel.',
    ],
    related: ['ueberzahl', 'ueberzahlspiel'],
  },
  {
    slug: 'boxplay',
    category: 'grundbegriffe',
    term: 'Boxplay',
    synonyms: ['4-gegen-5', 'Unterzahl-Verteidigung'],
    summary: 'Der gebräuchliche Name für organisiertes Verteidigen in Unterzahl.',
    body: [
      'Boxplay ist der übliche Begriff für das taktische Verteidigen in Unterzahl. Details zur Ausführung siehe Unterzahlspiel.',
    ],
    related: ['unterzahl', 'unterzahlspiel'],
  },

  // ── Training ───────────────────────────────────────────────────────
  {
    slug: 'aufwaermen',
    category: 'training',
    term: 'Aufwärmen',
    synonyms: ['Warm-up'],
    summary: 'Vorbereitender Trainingsteil zur Aktivierung von Kreislauf, Muskulatur und Konzentration.',
    body: [
      'Das Aufwärmen steht am Anfang jeder Trainingseinheit und jedes Spiels. Es senkt das Verletzungsrisiko und bereitet Körper und Kopf auf die folgende Belastung vor.',
    ],
    related: ['koordinationstraining', 'trainingseinheit-aufbau'],
  },
  {
    slug: 'koordinationstraining',
    category: 'training',
    term: 'Koordinationstraining',
    synonyms: ['Koordination'],
    summary: 'Übungen zur Verbesserung von Gleichgewicht, Reaktion und Bewegungssteuerung.',
    body: [
      'Koordinationstraining schult grundlegende Bewegungsfähigkeiten wie Gleichgewicht, Reaktionsschnelligkeit und Rhythmusgefühl – die Basis für saubere Technik unter Spielgeschwindigkeit.',
    ],
    related: ['techniktraining', 'aufwaermen'],
  },
  {
    slug: 'techniktraining',
    category: 'training',
    term: 'Techniktraining',
    synonyms: ['Technikschulung'],
    summary: 'Gezieltes Üben einzelner technischer Fertigkeiten wie Stockhandling oder Passspiel.',
    body: [
      'Im Techniktraining werden einzelne Fertigkeiten – etwa Stockhandling, Passgenauigkeit oder Schusstechnik – isoliert und wiederholt geübt, meist ohne Gegnerdruck.',
    ],
    related: ['stockhandling', 'schusstraining'],
  },
  {
    slug: 'schusstraining',
    category: 'training',
    term: 'Schusstraining',
    synonyms: ['Torschusstraining'],
    summary: 'Gezieltes Üben unterschiedlicher Schusstechniken und Abschlusssituationen.',
    body: [
      'Schusstraining übt gezielt verschiedene Abschlussarten (Schlenzer, Direktschuss) sowie das Verhalten im Slot vor dem Torabschluss.',
    ],
    related: ['schuss', 'schlenzer', 'direktschuss'],
  },

  // ── Spielorganisation ──────────────────────────────────────────────
  {
    slug: 'wechselblock',
    category: 'spielorganisation',
    term: 'Wechselblock',
    synonyms: ['Linie', 'Formation'],
    summary: 'Eine feste Gruppe von Feldspielern, die gemeinsam ein- und auswechselt.',
    body: [
      'Ein Kader wird meist in mehrere Wechselblöcke (Block 1, 2, 3 …) eingeteilt, die als feste Einheit gemeinsam auf dem Feld stehen und gemeinsam wechseln.',
      'So bekommt jeder Block klar definierte, aber kurze und intensive Einsatzzeiten.',
    ],
    related: ['wechsel', 'fliegender-wechsel', 'ersatzspieler'],
  },
  {
    slug: 'trainingseinheit-aufbau',
    category: 'spielorganisation',
    term: 'Aufbau einer Trainingseinheit',
    synonyms: ['Trainingsplanung'],
    summary: 'Der typische Ablauf: Warm-up, Technik, Taktik, Spielform, Cool-down.',
    body: [
      'Eine gut geplante Trainingseinheit folgt meist dem Ablauf Warm-up → Technik → Taktik → Spielform → Cool-down, damit Intensität und Lernziele sinnvoll aufeinander aufbauen.',
    ],
    related: ['aufwaermen', 'techniktraining'],
  },
  {
    slug: 'spieltag-organisation',
    category: 'spielorganisation',
    term: 'Spieltag-Organisation',
    synonyms: ['Matchday-Planung'],
    summary: 'Die organisatorische Vorbereitung eines Spiels: Kader, Anwesenheit, Anreise, Aufstellung.',
    body: [
      'Zur Spieltag-Organisation gehören unter anderem die Kaderplanung, das Erfassen von Zu-/Absagen, die Match-Aufstellung sowie die Dokumentation von Ergebnis und Ereignissen nach dem Spiel.',
    ],
    related: ['wechselblock'],
  },
];

// Bis eigene en/sv-Inhalte gepflegt sind, fällt jede Locale auf die
// deutschen Einträge zurück – Struktur ist bewusst schon lokal-fähig.
const GLOSSARY_BY_LOCALE = {
  de: GLOSSARY_ENTRIES_DE,
};

export function getGlossaryEntries(locale = 'de') {
  return GLOSSARY_BY_LOCALE[locale] ?? GLOSSARY_ENTRIES_DE;
}
