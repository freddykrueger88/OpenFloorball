# 📅 Kalender

*🇩🇪 Deutsch | [🇬🇧 English](Kalender.en.md)*

Unter `/calendar` erscheinen [Spiele](./Live-Spielnotizen.md) und
[Trainingseinheiten](./Trainingsplaner.md) gemeinsam in einer
Monatsansicht – farblich unterschieden (Spiele orange, Trainings
blau). Ein Klick auf einen Termin öffnet die jeweilige Detailseite.

## Umfang (bewusst einfach gehalten)

Reine Ansicht der bereits vorhandenen Termine, kein eigenes
Datenmodell: ein Spiel/eine Trainingseinheit braucht dafür nur ein
gesetztes Datum (Gegner-Datum bzw. geplantes Trainingsdatum). Ohne
Datum erscheint ein Termin nicht im Kalender, bleibt aber ganz normal
in der jeweiligen Listenansicht (`/games`, `/trainings`) sichtbar.

Aktuell nur Monatsansicht (keine Wochenansicht) – das ist ein eigener,
größerer Backlog-Punkt. Serientermine für Trainings gibt es bereits
(siehe [Trainingsplaner](./Trainingsplaner.md#serientermine)) – erzeugte
Folgetermine erscheinen automatisch auch hier im Kalender.

## Kalender-Abo (ICS-Export)

Unterhalb des Monatsrasters lässt sich ein persönlicher
Kalender-Feed erzeugen, der Spiele und Trainingseinheiten mit
gesetztem Datum in Google Calendar, Apple Kalender oder Outlook
abonniert. Der externe Kalender ruft die URL selbst regelmäßig ab –
neue oder geänderte Termine erscheinen dort automatisch, ohne dass du
etwas exportieren musst.

- **Abonnieren** öffnet direkt den Kalender-Client über das
  `webcal://`-Schema (funktioniert bei den meisten Kalender-Apps ohne
  weiteren Schritt).
- Die reine `https://`-URL lässt sich daneben kopieren – nötig für
  Kalender, die nur den manuellen "Von URL abonnieren"-Weg anbieten
  (z.B. Google Calendar am Desktop).
- **Neu erzeugen** ersetzt den bestehenden Link vollständig; die alte
  URL funktioniert danach nicht mehr.
- **Widerrufen** deaktiviert den Feed vollständig, bis ein neuer
  erzeugt wird.

Der Link selbst enthält keinen Login – wer ihn kennt, kann die
darüber sichtbaren Termine (Gegner-/Trainingsnamen und Datum) lesen,
aber nichts verändern. Wie bei Board-Share-Links gilt: den Link nicht
öffentlich teilen, wenn die Termine nicht für Dritte sichtbar sein
sollen.

## Verwandt

- [Live-Spielnotizen](./Live-Spielnotizen.md)
- [Trainingsplaner](./Trainingsplaner.md)
