// Map country names to flag emojis
const countryToFlag: Record<string, string> = {
  'france': '🇫🇷', 'fr': '🇫🇷',
  'allemagne': '🇩🇪', 'germany': '🇩🇪', 'de': '🇩🇪',
  'espagne': '🇪🇸', 'spain': '🇪🇸', 'es': '🇪🇸',
  'italie': '🇮🇹', 'italy': '🇮🇹', 'it': '🇮🇹',
  'royaume-uni': '🇬🇧', 'uk': '🇬🇧', 'united kingdom': '🇬🇧', 'gb': '🇬🇧', 'angleterre': '🇬🇧',
  'états-unis': '🇺🇸', 'usa': '🇺🇸', 'united states': '🇺🇸', 'us': '🇺🇸', 'etats-unis': '🇺🇸',
  'belgique': '🇧🇪', 'belgium': '🇧🇪', 'be': '🇧🇪',
  'suisse': '🇨🇭', 'switzerland': '🇨🇭', 'ch': '🇨🇭',
  'pays-bas': '🇳🇱', 'netherlands': '🇳🇱', 'nl': '🇳🇱', 'hollande': '🇳🇱',
  'portugal': '🇵🇹', 'pt': '🇵🇹',
  'autriche': '🇦🇹', 'austria': '🇦🇹', 'at': '🇦🇹',
  'canada': '🇨🇦', 'ca': '🇨🇦',
  'japon': '🇯🇵', 'japan': '🇯🇵', 'jp': '🇯🇵',
  'chine': '🇨🇳', 'china': '🇨🇳', 'cn': '🇨🇳',
  'australie': '🇦🇺', 'australia': '🇦🇺', 'au': '🇦🇺',
  'brésil': '🇧🇷', 'brazil': '🇧🇷', 'br': '🇧🇷', 'bresil': '🇧🇷',
  'mexique': '🇲🇽', 'mexico': '🇲🇽', 'mx': '🇲🇽',
  'inde': '🇮🇳', 'india': '🇮🇳', 'in': '🇮🇳',
  'corée du sud': '🇰🇷', 'south korea': '🇰🇷', 'kr': '🇰🇷', 'coree du sud': '🇰🇷',
  'danemark': '🇩🇰', 'denmark': '🇩🇰', 'dk': '🇩🇰',
  'suède': '🇸🇪', 'sweden': '🇸🇪', 'se': '🇸🇪', 'suede': '🇸🇪',
  'norvège': '🇳🇴', 'norway': '🇳🇴', 'no': '🇳🇴', 'norvege': '🇳🇴',
  'finlande': '🇫🇮', 'finland': '🇫🇮', 'fi': '🇫🇮',
  'pologne': '🇵🇱', 'poland': '🇵🇱', 'pl': '🇵🇱',
  'irlande': '🇮🇪', 'ireland': '🇮🇪', 'ie': '🇮🇪',
  'grèce': '🇬🇷', 'greece': '🇬🇷', 'gr': '🇬🇷', 'grece': '🇬🇷',
  'luxembourg': '🇱🇺', 'lu': '🇱🇺',
  'monaco': '🇲🇨', 'mc': '🇲🇨',
  'taiwan': '🇹🇼', 'tw': '🇹🇼',
  'singapour': '🇸🇬', 'singapore': '🇸🇬', 'sg': '🇸🇬',
  'émirats arabes unis': '🇦🇪', 'uae': '🇦🇪', 'emirats arabes unis': '🇦🇪',
  'israel': '🇮🇱', 'israël': '🇮🇱', 'il': '🇮🇱',
  'turquie': '🇹🇷', 'turkey': '🇹🇷', 'tr': '🇹🇷',
  'maroc': '🇲🇦', 'morocco': '🇲🇦', 'ma': '🇲🇦',
  'tunisie': '🇹🇳', 'tunisia': '🇹🇳', 'tn': '🇹🇳',
  'afrique du sud': '🇿🇦', 'south africa': '🇿🇦', 'za': '🇿🇦',
  'roumanie': '🇷🇴', 'romania': '🇷🇴', 'ro': '🇷🇴',
  'hongrie': '🇭🇺', 'hungary': '🇭🇺', 'hu': '🇭🇺',
  'tchéquie': '🇨🇿', 'czech republic': '🇨🇿', 'czechia': '🇨🇿', 'cz': '🇨🇿', 'tchequie': '🇨🇿',
  'nouvelle-zélande': '🇳🇿', 'new zealand': '🇳🇿', 'nz': '🇳🇿',
};

export function getCountryFlag(country: string | null | undefined): string {
  if (!country) return '';
  const key = country.trim().toLowerCase();
  return countryToFlag[key] || '';
}
