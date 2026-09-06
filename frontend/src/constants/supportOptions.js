/**
 * supportOptions.js – zentrale, leicht erweiterbare Konfiguration für die
 * Support-Seite: neue Spenden-/Affiliate-Optionen einfach hier ergänzen
 * (Eintrag in SUPPORT_OPTIONS anfügen), der Rest rendert sich automatisch.
 */
export const SUPPORT_OPTIONS = [
  {
    id: 'github-sponsors',
    href: 'https://github.com/sponsors/freddykrueger88',
    labelKey: 'supportPage.donations.githubSponsors',
    descriptionKey: 'supportPage.donations.githubSponsorsDesc',
  },
  {
    id: 'open-collective',
    href: 'https://opencollective.com/freddykrueger',
    labelKey: 'supportPage.donations.openCollective',
    descriptionKey: 'supportPage.donations.openCollectiveDesc',
  },
];

export const HELP_OPTIONS = [
  {
    id: 'issues',
    href: 'https://github.com/freddykrueger88/OpenFloorball/issues',
    labelKey: 'supportPage.help.issues',
    descriptionKey: 'supportPage.help.issuesDesc',
  },
  {
    id: 'code',
    href: 'https://github.com/freddykrueger88/OpenFloorball/blob/main/CONTRIBUTING.md',
    labelKey: 'supportPage.help.code',
    descriptionKey: 'supportPage.help.codeDesc',
  },
  {
    id: 'translate',
    href: 'https://github.com/freddykrueger88/OpenFloorball/blob/main/docs/TRANSLATING.md',
    labelKey: 'supportPage.help.translate',
    descriptionKey: 'supportPage.help.translateDesc',
  },
];