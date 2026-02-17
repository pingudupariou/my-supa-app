// Convert ISO 3166-1 alpha-2 code to flag emoji
function isoToFlag(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return '';
  const offset = 0x1F1E6 - 65; // 'A' = 65
  return String.fromCodePoint(upper.charCodeAt(0) + offset, upper.charCodeAt(1) + offset);
}

// Map country names (FR/EN) to ISO 3166-1 alpha-2 codes
const countryToISO: Record<string, string> = {
  // French names
  'france': 'FR', 'allemagne': 'DE', 'espagne': 'ES', 'italie': 'IT',
  'royaume-uni': 'GB', 'angleterre': 'GB', 'états-unis': 'US', 'etats-unis': 'US',
  'belgique': 'BE', 'suisse': 'CH', 'pays-bas': 'NL', 'hollande': 'NL',
  'portugal': 'PT', 'autriche': 'AT', 'japon': 'JP', 'chine': 'CN',
  'australie': 'AU', 'brésil': 'BR', 'bresil': 'BR', 'mexique': 'MX',
  'inde': 'IN', 'corée du sud': 'KR', 'coree du sud': 'KR', 'corée': 'KR', 'coree': 'KR',
  'danemark': 'DK', 'suède': 'SE', 'suede': 'SE', 'norvège': 'NO', 'norvege': 'NO',
  'finlande': 'FI', 'pologne': 'PL', 'irlande': 'IE', 'grèce': 'GR', 'grece': 'GR',
  'luxembourg': 'LU', 'monaco': 'MC', 'taiwan': 'TW', 'taïwan': 'TW',
  'singapour': 'SG', 'émirats arabes unis': 'AE', 'emirats arabes unis': 'AE',
  'israël': 'IL', 'israel': 'IL', 'turquie': 'TR', 'maroc': 'MA',
  'tunisie': 'TN', 'afrique du sud': 'ZA', 'roumanie': 'RO', 'hongrie': 'HU',
  'tchéquie': 'CZ', 'tchequie': 'CZ', 'république tchèque': 'CZ', 'republique tcheque': 'CZ',
  'nouvelle-zélande': 'NZ', 'nouvelle-zelande': 'NZ', 'canada': 'CA',
  'qatar': 'QA', 'arabie saoudite': 'SA', 'koweït': 'KW', 'koweit': 'KW',
  'bahreïn': 'BH', 'bahrein': 'BH', 'oman': 'OM', 'liban': 'LB',
  'jordanie': 'JO', 'égypte': 'EG', 'egypte': 'EG', 'algérie': 'DZ', 'algerie': 'DZ',
  'sénégal': 'SN', 'senegal': 'SN', 'côte d\'ivoire': 'CI', 'cote d\'ivoire': 'CI',
  'cameroun': 'CM', 'nigeria': 'NG', 'kenya': 'KE', 'ghana': 'GH',
  'colombie': 'CO', 'argentine': 'AR', 'chili': 'CL', 'pérou': 'PE', 'perou': 'PE',
  'venezuela': 'VE', 'uruguay': 'UY', 'paraguay': 'PY', 'equateur': 'EC', 'équateur': 'EC',
  'bolivie': 'BO', 'costa rica': 'CR', 'panama': 'PA', 'cuba': 'CU',
  'thaïlande': 'TH', 'thailande': 'TH', 'vietnam': 'VN', 'viêt nam': 'VN',
  'malaisie': 'MY', 'indonésie': 'ID', 'indonesie': 'ID', 'philippines': 'PH',
  'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK', 'népal': 'NP', 'nepal': 'NP',
  'russie': 'RU', 'ukraine': 'UA', 'biélorussie': 'BY', 'bielorussie': 'BY',
  'géorgie': 'GE', 'georgie': 'GE', 'arménie': 'AM', 'armenie': 'AM',
  'azerbaïdjan': 'AZ', 'azerbaidjan': 'AZ', 'kazakhstan': 'KZ',
  'croatie': 'HR', 'serbie': 'RS', 'slovénie': 'SI', 'slovenie': 'SI',
  'slovaquie': 'SK', 'bulgarie': 'BG', 'lituanie': 'LT', 'lettonie': 'LV',
  'estonie': 'EE', 'malte': 'MT', 'chypre': 'CY', 'islande': 'IS',
  'albanie': 'AL', 'macédoine du nord': 'MK', 'macedoine du nord': 'MK',
  'monténégro': 'ME', 'montenegro': 'ME', 'bosnie': 'BA', 'bosnie-herzégovine': 'BA',
  'moldavie': 'MD', 'andorre': 'AD', 'liechtenstein': 'LI', 'saint-marin': 'SM',

  // English names
  'germany': 'DE', 'spain': 'ES', 'italy': 'IT', 'united kingdom': 'GB',
  'united states': 'US', 'belgium': 'BE', 'switzerland': 'CH', 'netherlands': 'NL',
  'austria': 'AT', 'japan': 'JP', 'china': 'CN', 'australia': 'AU',
  'brazil': 'BR', 'mexico': 'MX', 'india': 'IN', 'south korea': 'KR',
  'denmark': 'DK', 'sweden': 'SE', 'norway': 'NO', 'finland': 'FI',
  'poland': 'PL', 'ireland': 'IE', 'greece': 'GR', 'singapore': 'SG',
  'turkey': 'TR', 'morocco': 'MA', 'tunisia': 'TN', 'south africa': 'ZA',
  'romania': 'RO', 'hungary': 'HU', 'czech republic': 'CZ', 'czechia': 'CZ',
  'new zealand': 'NZ', 'saudi arabia': 'SA', 'kuwait': 'KW', 'bahrain': 'BH',
  'jordan': 'JO', 'egypt': 'EG', 'algeria': 'DZ', 'ivory coast': 'CI',
  'cameroon': 'CM', 'colombia': 'CO', 'argentina': 'AR', 'chile': 'CL',
  'peru': 'PE', 'thailand': 'TH', 'malaysia': 'MY', 'indonesia': 'ID',
  'russia': 'RU', 'croatia': 'HR', 'serbia': 'RS', 'slovenia': 'SI',
  'slovakia': 'SK', 'bulgaria': 'BG', 'lithuania': 'LT', 'latvia': 'LV',
  'estonia': 'EE', 'malta': 'MT', 'cyprus': 'CY', 'iceland': 'IS',
  'bosnia': 'BA', 'moldova': 'MD', 'andorra': 'AD',
};

export function getCountryFlag(country: string | null | undefined): string {
  if (!country) return '';
  const trimmed = country.trim();
  const key = trimmed.toLowerCase();

  // 1. Try direct name lookup
  if (countryToISO[key]) {
    return isoToFlag(countryToISO[key]);
  }

  // 2. If it's already a 2-letter ISO code, convert directly
  if (/^[a-zA-Z]{2}$/.test(trimmed)) {
    return isoToFlag(trimmed);
  }

  // 3. Try partial match (for cases like "Corée du Sud" stored as "Corée du\nSud")
  for (const [name, iso] of Object.entries(countryToISO)) {
    if (key.includes(name) || name.includes(key)) {
      return isoToFlag(iso);
    }
  }

  return '';
}
