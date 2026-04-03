/**
 * Navigation Phrase Dictionary for TrashDrop Collector App
 *
 * Pre-translated navigation phrases for voice guidance in local Ghanaian languages.
 * Placeholders use {variable} syntax and are replaced at runtime.
 *
 * Languages covered:
 *   tw  — Twi (Akan / Ashanti)
 *   fan — Fante (Akan / Central-Western)
 *   ee  — Ewe
 *   dag — Dagbani
 *   gaa — Ga
 *   ha  — Hausa
 *   en  — English (fallback)
 *
 * Phase 2 will replace these with pre-recorded audio clips per phrase.
 * Phase 3 will use WAXAL-powered TTS models for dynamic generation.
 */

const NAVIGATION_PHRASES = {
  // ─── Twi (Akan / Ashanti) ──────────────────────────────────
  tw: {
    // Navigation start / stop
    starting_navigation: 'Yɛrefi ase akwantu kɔ {destination}',
    navigation_stopped: 'Akwantu no agyae',
    route_calculated: 'Akwan {steps} wɔ hɔ. Yɛnkɔ!',

    // Turn-by-turn
    turn_left: 'Dan kɔ benkum',
    turn_right: 'Dan kɔ nifa',
    go_straight: 'Kɔ w\'anim tee',
    make_u_turn: 'Dan w\'ase san w\'akyi',
    slight_left: 'Kɔ benkum kakra',
    slight_right: 'Kɔ nifa kakra',
    keep_left: 'Fa benkum fam',
    keep_right: 'Fa nifa fam',
    roundabout: 'Fa roundabout no so',
    merge: 'Bɔ mu',
    in_distance: 'Wɔ {distance} mu, {instruction}',

    // Arrival
    you_have_arrived: 'Woadu! Wo wɔ {destination}.',
    arrival_pickup: 'Woadu! Scan QR code no.',
    arrival_assignment: 'Woadu! Wo betumi afi ase twitwa ho.',
    arrival_disposal: 'Woadu disposal site hɔ. Yɛsrɛ hwie gu.',

    // Actions
    scan_qr: 'Fa wo fon scan QR code no',
    start_cleaning: 'Fi ase twitwa ho',
    start_navigation: 'Fi ase akwantu',
    stop_navigation: 'Gyae akwantu',
    accept_request: 'Gye adwuma no',
    complete_task: 'Adwuma no awie',

    // Status
    getting_location: 'Yɛrehwehwɛ wo gyinabea...',
    gps_acquired: 'Yɛanya wo gyinabea',
    offline_mode: 'Wo nni intanɛt so. Na yɛde cache adi dwuma.',
    connection_restored: 'Intanɛt aba. Yɛresync data...',
    distance_remaining: '{distance} aka',
    within_geofence: 'Wo abɛn! {distance} nka.',

    // Errors
    location_error: 'Yɛntumi nnya wo gyinabea. Yɛsrɛ sɔ GPS on.',
    route_error: 'Yɛntumi nsi akwan. Yɛsrɛ bɔ mmɔden bio.',
    navigation_failed: 'Akwantu no antumi. Bɔ mmɔden bio.',

    // Alerts
    new_request_nearby: 'Adwuma foforo wɔ wo nkyɛn!',
    urgent_request: 'Adwuma a ɛhia paa wɔ wo nkyɛn!',
  },

  // ─── Fante (Akan / Central-Western) ───────────────────────
  fan: {
    starting_navigation: 'Yɛrefi ase akwantu kɔ {destination}',
    navigation_stopped: 'Akwantu no egyae',
    route_calculated: 'Akwan {steps} wɔ hɔ. Momma yɛnkɔ!',

    turn_left: 'Dan kɔ benkum',
    turn_right: 'Dan kɔ nifa',
    go_straight: 'Kɔ w\'anim tee',
    make_u_turn: 'Dan w\'ase san w\'akyi',
    slight_left: 'Kɔ benkum kakra',
    slight_right: 'Kɔ nifa kakra',
    keep_left: 'Fa benkum fam',
    keep_right: 'Fa nifa fam',
    roundabout: 'Fa roundabout no so',
    merge: 'Bɔ mu',
    in_distance: 'Wɔ {distance} mu, {instruction}',

    you_have_arrived: 'Woadu! Wo wɔ {destination}.',
    arrival_pickup: 'Woadu! Scan QR code no.',
    arrival_assignment: 'Woadu! Wo betumi efi ase atwitwa ho.',
    arrival_disposal: 'Woadu disposal site hɔ. Yɛsrɛ hwie gu.',

    scan_qr: 'Fa wo fon scan QR code no',
    start_cleaning: 'Fi ase twitwa ho',
    start_navigation: 'Fi ase akwantu',
    stop_navigation: 'Gyae akwantu',
    accept_request: 'Gye adwuma no',
    complete_task: 'Adwuma no ewie',

    getting_location: 'Yɛrehwehwɛ wo gyinabea...',
    gps_acquired: 'Yɛanya wo gyinabea',
    offline_mode: 'Wo nni intanɛt so.',
    connection_restored: 'Intanɛt aba.',
    distance_remaining: '{distance} eka',
    within_geofence: 'Wo abɛn! {distance} nka.',

    location_error: 'Yɛntumi nnya wo gyinabea. Sɔ GPS on.',
    route_error: 'Yɛntumi nsi akwan. Bɔ mmɔden bio.',
    navigation_failed: 'Akwantu no antumi. Bɔ mmɔden bio.',

    new_request_nearby: 'Adwuma foforo wɔ wo nkyɛn!',
    urgent_request: 'Adwuma a ɛhia paa wɔ wo nkyɛn!',
  },

  // ─── Ewe ──────────────────────────────────────────────────
  ee: {
    starting_navigation: 'Míele mɔzɔzɔ me ɖe {destination}',
    navigation_stopped: 'Mɔzɔzɔ la esi',
    route_calculated: 'Afɔɖeɖe {steps} le eme. Míayi!',

    turn_left: 'Trɔ yi mia',
    turn_right: 'Trɔ yi dzí',
    go_straight: 'Yi ɖe ngɔgbe',
    make_u_turn: 'Trɔ gbɔ megbe',
    slight_left: 'Yi mia ƒe akpa vi ɖeka',
    slight_right: 'Yi dzí ƒe akpa vi ɖeka',
    keep_left: 'Lɔ̃ mia',
    keep_right: 'Lɔ̃ dzí',
    roundabout: 'Zi roundabout la dzi',
    merge: 'Kpɔ ɖeka',
    in_distance: 'Le {distance} me, {instruction}',

    you_have_arrived: 'Nèdo! Nèle {destination}.',
    arrival_pickup: 'Nèdo! Scan QR code la.',
    arrival_assignment: 'Nèdo! Àte ŋu adze eƒe dɔ la gɔme.',
    arrival_disposal: 'Nèdo disposal site. Meɖe kuku kpɔ gu.',

    scan_qr: 'Zã wò fon scan QR code la',
    start_cleaning: 'Dze kpɔkplɔ gɔme',
    start_navigation: 'Dze mɔzɔzɔ gɔme',
    stop_navigation: 'Esi mɔzɔzɔ',
    accept_request: 'Xɔ dɔ la',
    complete_task: 'Dɔ la vɔ',

    getting_location: 'Míele wò nɔƒe dim...',
    gps_acquired: 'Míekpɔ wò nɔƒe',
    offline_mode: 'Internet meli o. Míezã cache.',
    connection_restored: 'Internet va. Míele sync wom...',
    distance_remaining: '{distance} kee',
    within_geofence: 'Nèsɔ gbɔ! {distance} kee.',

    location_error: 'Míemate ŋu akpɔ wò nɔƒe o. Ƒu GPS ɖe ŋu.',
    route_error: 'Míemate ŋu adi mɔ o. Taflatse gbugbɔ tso.',
    navigation_failed: 'Mɔzɔzɔ la mekpɔ mɔ o. Gbugbɔ tso.',

    new_request_nearby: 'Dɔ yeye le wò gbɔ!',
    urgent_request: 'Dɔ si hiã ŋutɔ le wò gbɔ!',
  },

  // ─── Dagbani ──────────────────────────────────────────────
  dag: {
    starting_navigation: 'Ti piligi soli ni chaŋ {destination}',
    navigation_stopped: 'Soli la saɣi',
    route_calculated: 'Naan-yɛla {steps} be niŋ. Ti chaŋ!',

    turn_left: 'Labi chaŋ achiŋa',
    turn_right: 'Labi chaŋ adua',
    go_straight: 'Chaŋ tee',
    make_u_turn: 'Labi kpe nyaaŋa',
    slight_left: 'Chaŋ achiŋa biɛla',
    slight_right: 'Chaŋ adua biɛla',
    keep_left: 'Dihi achiŋa',
    keep_right: 'Dihi adua',
    roundabout: 'Gbaai roundabout la zuɣu',
    merge: 'Kpɛhi taɣa',
    in_distance: 'Ka {distance}, {instruction}',

    you_have_arrived: 'A pahi! A be {destination}.',
    arrival_pickup: 'A pahi! Scan QR code la.',
    arrival_assignment: 'A pahi! A ni tum piɛhi tuma la.',
    arrival_disposal: 'A pahi disposal site. Chɛ ti zuɣu.',

    scan_qr: 'Tihi a phone scan QR code la',
    start_cleaning: 'Piɛhi tuma',
    start_navigation: 'Piɛhi soli',
    stop_navigation: 'Saɣi soli',
    accept_request: 'Diɛ tuma la',
    complete_task: 'Tuma la saɣi',

    getting_location: 'Ti niŋdi a yidana...',
    gps_acquired: 'Ti nyɛ a yidana',
    offline_mode: 'Internet ka bɛ. Ti tihi cache.',
    connection_restored: 'Internet kpɛm. Ti sync data...',
    distance_remaining: '{distance} ka',
    within_geofence: 'A paai! {distance} ka.',

    location_error: 'Ti ki nyɛ a yidana. Yɛli GPS on.',
    route_error: 'Ti ki tum niŋ soli. Maalimi bio.',
    navigation_failed: 'Soli la ki tum niŋ. Maalimi bio.',

    new_request_nearby: 'Tumpahili palli be a suɣu!',
    urgent_request: 'Tumpahili ŋun zaŋ bɛ a suɣu!',
  },

  // ─── Ga ───────────────────────────────────────────────────
  gaa: {
    starting_navigation: 'Mínyɛ yibaa yɛ {destination}',
    navigation_stopped: 'Yibaa lɛ he hii',
    route_calculated: 'Gbɛjii {steps} le mli. Míba!',

    turn_left: 'Kɛ gbee',
    turn_right: 'Kɛ bulu',
    go_straight: 'Ba yoo jɛmaŋ',
    make_u_turn: 'Kɛ lɛ na akyii',
    slight_left: 'Ba gbee fɛɛ',
    slight_right: 'Ba bulu fɛɛ',
    keep_left: 'Shi gbee fɛɛ',
    keep_right: 'Shi bulu fɛɛ',
    roundabout: 'Kɛ roundabout lɛ ni',
    merge: 'He eko',
    in_distance: 'Ni {distance} mli, {instruction}',

    you_have_arrived: 'Aba! Olɛ {destination}.',
    arrival_pickup: 'Aba! Scan QR code lɛ.',
    arrival_assignment: 'Aba! Oye shi shwane.',
    arrival_disposal: 'Aba disposal site. Naagbɛ fɔɔ he.',

    scan_qr: 'Tsɔ wo phone scan QR code lɛ',
    start_cleaning: 'Shi shwane',
    start_navigation: 'Shi yibaa',
    stop_navigation: 'He yibaa hii',
    accept_request: 'Gbe dɔŋ lɛ',
    complete_task: 'Dɔŋ lɛ he hii',

    getting_location: 'Míkpɛ wo tetee...',
    gps_acquired: 'Mínyɛ wo tetee',
    offline_mode: 'Internet nii fɛɛ. Míhe cache.',
    connection_restored: 'Internet aba. Mísync data...',
    distance_remaining: '{distance} lɛ kɛha',
    within_geofence: 'Obɛ! {distance} lɛ kɛha.',

    location_error: 'Míhu kpɛ wo tetee. Ɔ lɛ GPS on.',
    route_error: 'Míhu kpɛ mɔ. Naagbɛ yɛ bio.',
    navigation_failed: 'Yibaa lɛ hu kpɛ. Yɛ bio.',

    new_request_nearby: 'Dɔŋ fofo le wo hee!',
    urgent_request: 'Dɔŋ si hiã tsɔ le wo hee!',
  },

  // ─── Hausa ────────────────────────────────────────────────
  ha: {
    starting_navigation: 'Ana fara tafiya zuwa {destination}',
    navigation_stopped: 'An dakatar da tafiya',
    route_calculated: 'Mataki {steps}. Mu tafi!',

    turn_left: 'Juya hagu',
    turn_right: 'Juya dama',
    go_straight: 'Ci gaba kai tsaye',
    make_u_turn: 'Juya baya',
    slight_left: 'Karkatar zuwa hagu',
    slight_right: 'Karkatar zuwa dama',
    keep_left: 'Ci gaba hagu',
    keep_right: 'Ci gaba dama',
    roundabout: 'Bi ta zagaye',
    merge: 'Hade',
    in_distance: 'A cikin {distance}, {instruction}',

    you_have_arrived: 'Ka iso! Kana a {destination}.',
    arrival_pickup: 'Ka iso! Duba QR code.',
    arrival_assignment: 'Ka iso! Za ka fara aiki.',
    arrival_disposal: 'Ka iso disposal site. Ka zubar.',

    scan_qr: 'Yi amfani da wayanka don scan QR code',
    start_cleaning: 'Fara tsaftacewa',
    start_navigation: 'Fara tafiya',
    stop_navigation: 'Dakatar da tafiya',
    accept_request: 'Karbi aiki',
    complete_task: 'Aiki ya kare',

    getting_location: 'Ana neman wurinka...',
    gps_acquired: 'An sami wurinka',
    offline_mode: 'Babu intanet. Ana amfani da cache.',
    connection_restored: 'Intanet ya dawo. Ana sync...',
    distance_remaining: '{distance} ya rage',
    within_geofence: 'Ka yi kusa! {distance} ya rage.',

    location_error: 'Ba a sami wurinka ba. Kunna GPS.',
    route_error: 'Ba a sami hanya ba. Sake gwadawa.',
    navigation_failed: 'Tafiya ta kasa. Sake gwadawa.',

    new_request_nearby: 'Sabon aiki yana kusa!',
    urgent_request: 'Aiki mai gaggawa yana kusa!',
  },

  // ─── English (fallback) ───────────────────────────────────
  en: {
    starting_navigation: 'Starting navigation to {destination}',
    navigation_stopped: 'Navigation stopped',
    route_calculated: '{steps} steps to destination. Let\'s go!',

    turn_left: 'Turn left',
    turn_right: 'Turn right',
    go_straight: 'Continue straight',
    make_u_turn: 'Make a U-turn',
    slight_left: 'Slight left',
    slight_right: 'Slight right',
    keep_left: 'Keep left',
    keep_right: 'Keep right',
    roundabout: 'Enter the roundabout',
    merge: 'Merge',
    in_distance: 'In {distance}, {instruction}',

    you_have_arrived: 'You have arrived at {destination}.',
    arrival_pickup: 'You have arrived! Scan the QR code.',
    arrival_assignment: 'You have arrived! You can now start cleaning.',
    arrival_disposal: 'You have arrived at the disposal site. Please dispose the waste.',

    scan_qr: 'Use your phone to scan the QR code',
    start_cleaning: 'Start cleaning',
    start_navigation: 'Start navigation',
    stop_navigation: 'Stop navigation',
    accept_request: 'Accept request',
    complete_task: 'Task completed',

    getting_location: 'Getting your location...',
    gps_acquired: 'Location acquired',
    offline_mode: 'You are offline. Using cached data.',
    connection_restored: 'Connection restored. Syncing data...',
    distance_remaining: '{distance} remaining',
    within_geofence: 'Almost there! {distance} remaining.',

    location_error: 'Could not get your location. Please enable GPS.',
    route_error: 'Could not calculate route. Please try again.',
    navigation_failed: 'Navigation failed. Please try again.',

    new_request_nearby: 'New request nearby!',
    urgent_request: 'Urgent request nearby!',
  }
};

/**
 * Get a translated phrase with variable substitution.
 *
 * @param {string} key   — Phrase key (e.g. 'turn_left', 'you_have_arrived')
 * @param {string} lang  — Language code (e.g. 'tw', 'ee', 'en')
 * @param {Object} vars  — Variables to substitute (e.g. { destination: 'Madina Market' })
 * @returns {string}     — Translated phrase with variables replaced
 */
export const getPhrase = (key, lang = 'en', vars = {}) => {
  // Try requested language, fall back to English
  const phrase = NAVIGATION_PHRASES[lang]?.[key]
    || NAVIGATION_PHRASES['en']?.[key]
    || key;

  // Replace {variable} placeholders
  return Object.entries(vars).reduce(
    (text, [varName, value]) => text.replace(new RegExp(`\\{${varName}\\}`, 'g'), value),
    phrase
  );
};

/**
 * Map Google Maps maneuver strings to our phrase keys.
 */
export const MANEUVER_TO_PHRASE = {
  'turn-left': 'turn_left',
  'turn-right': 'turn_right',
  'turn-slight-left': 'slight_left',
  'turn-slight-right': 'slight_right',
  'turn-sharp-left': 'turn_left',
  'turn-sharp-right': 'turn_right',
  'uturn-left': 'make_u_turn',
  'uturn-right': 'make_u_turn',
  'keep-left': 'keep_left',
  'keep-right': 'keep_right',
  'roundabout-left': 'roundabout',
  'roundabout-right': 'roundabout',
  'merge': 'merge',
  'straight': 'go_straight',
  '': 'go_straight'
};

/**
 * Translate a Google Maps navigation instruction into the collector's language.
 * Falls back to the raw instruction text if no maneuver mapping exists.
 *
 * @param {Object} step   — Navigation step from Directions API
 * @param {string} lang   — Language code
 * @returns {string}      — Localized instruction
 */
export const translateNavInstruction = (step, lang = 'en') => {
  if (!step) return '';

  const maneuver = step.maneuver || '';
  const phraseKey = MANEUVER_TO_PHRASE[maneuver];

  if (phraseKey && lang !== 'en') {
    const localizedDirection = getPhrase(phraseKey, lang);
    const distance = step.distance || '';

    if (distance) {
      return getPhrase('in_distance', lang, { distance, instruction: localizedDirection });
    }
    return localizedDirection;
  }

  // For English or unmapped maneuvers, use the original instruction text
  const rawText = (step.instruction || step.instructions || '').replace(/<[^>]*>/g, '');
  return rawText;
};

export default NAVIGATION_PHRASES;
