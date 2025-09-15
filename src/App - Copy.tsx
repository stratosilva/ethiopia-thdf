import React, { useState, useMemo, useEffect } from "react";

/**
 * Fully functional version of the Traveler Declaration app.
 *
 * This implementation loads dynamic metadata from the DHIS2 server (countries and
 * clinical questions), supports new declarations, editing existing ones, and
 * generating QR codes that encode the declaration token and risk classification.
 * It replaces the previous prototype where metadata was hard coded and
 * submission simply displayed an alert.
 */

// ====== External assets ======
const MOH_LOGO_URL =
  "https://merqconsultancy.org/wp-content/uploads/2024/08/MOH_logo_text-1024x876.png";
const MOH_LOGO_FALLBACK =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Health_Ministry_Ethiopia_Logo.png/200px-Health_Ministry_Ethiopia_Logo.png";
const EPHI_LOGO_URL =
  "https://epheb.ewenet.net/wp-content/uploads/2022/09/ephi-1024x1003.png";
const FLAG_BG_URL =
  "https://t4.ftcdn.net/jpg/05/41/67/13/360_F_541671367_G8zPVB2yUkV92ssLW9CAhK2WVBi1rN05.jpg";

// ====== DHIS2 configuration ======
const DHIS2_URL = "https://staging.ephi.gov.et";
const DHIS2_TOKEN = "d2pat_p8r4sXBFbbW2qNlg7T2D57OUPSo85dnE4025518869";

// When running in development (localhost), use a proxy path `/dhis2` to avoid
// browser CORS restrictions. This prefix will be rewritten by Vite's proxy
// configuration to point at the DHIS2 server. In production builds (where
// import.meta.env.DEV is false), fall back to the full DHIS2 URL.
const API_PREFIX = import.meta.env && import.meta.env.DEV ? '/dhis2' : `${DHIS2_URL}/api`;

// The program and program stages used by the traveler declaration workflow
const PROGRAM_ID = "pam2gg32GIX";
const TRAVEL_STAGE_ID = "ECqXBCJdIJW";
const CLINICAL_STAGE_ID = "nqE0Yrh0XvW";
const ORG_UNIT_ID = "P9dOOh865eF"; // Bole International Airport
// Tracked entity type for travelers program. This must match the program's
// trackedEntityType to avoid E1022 errors when submitting.
const TRACKED_ENTITY_TYPE_ID = "NfwwxcCXeKS";

// ====== Static options ======
const SEX_OPTIONS = [
  { label: "Female", value: "FEMALE" },
  { label: "Male", value: "MALE" },
  { label: "Other", value: "OTHER" },
];

const PURPOSES = [
  { label: "Tourism", value: "TOURISM" },
  { label: "Business", value: "BUSINESS" },
  { label: "Visiting Family/Friends", value: "VISITING_FAMILY_FRIENDS" },
  { label: "Resident", value: "RESIDENT" },
  { label: "Transit < 8h", value: "TRANSIT_LT_8H" },
  { label: "Layover > 8h", value: "LAYOVER_GT_8H" },
  { label: "Medical", value: "MEDICAL" },
  { label: "Education", value: "EDUCATION" },
  { label: "Official/Diplomatic", value: "OFFICIAL_DIPLOMATIC" },
  { label: "Religious/Pilgrimage", value: "RELIGIOUS_PILGRIMAGE" },
  { label: "Other", value: "OTHER" },
];

const YES_NO_UNSURE = [
  { label: "Yes", value: "YES" },
  { label: "No", value: "NO" },
  { label: "Unsure", value: "UNSURE" },
];

// List of countries with unique ISO codes. This is used for both nationality
// and country of origin/departure selectors. Having a single authoritative list
// helps avoid duplicate keys in the UI.
const COUNTRY_LIST: { label: string; value: string }[] = [
  { label: "Ethiopia", value: "ET" },
  { label: "Afghanistan", value: "AF" },
  { label: "Aland Islands", value: "AX" },
  { label: "Albania", value: "AL" },
  { label: "Algeria", value: "DZ" },
  { label: "American Samoa", value: "AS" },
  { label: "Andorra", value: "AD" },
  { label: "Angola", value: "AO" },
  { label: "Anguilla", value: "AI" },
  { label: "Antarctica", value: "AQ" },
  { label: "Antigua and Barbuda", value: "AG" },
  { label: "Argentina", value: "AR" },
  { label: "Armenia", value: "AM" },
  { label: "Aruba", value: "AW" },
  { label: "Australia", value: "AU" },
  { label: "Austria", value: "AT" },
  { label: "Azerbaijan", value: "AZ" },
  { label: "Bahamas", value: "BS" },
  { label: "Bahrain", value: "BH" },
  { label: "Bangladesh", value: "BD" },
  { label: "Barbados", value: "BB" },
  { label: "Belarus", value: "BY" },
  { label: "Belgium", value: "BE" },
  { label: "Belize", value: "BZ" },
  { label: "Benin", value: "BJ" },
  { label: "Bermuda", value: "BM" },
  { label: "Bhutan", value: "BT" },
  { label: "Bolivia, Plurinational State of bolivia", value: "BO" },
  { label: "Bosnia and Herzegovina", value: "BA" },
  { label: "Botswana", value: "BW" },
  { label: "Bouvet Island", value: "BV" },
  { label: "Brazil", value: "BR" },
  { label: "British Indian Ocean Territory", value: "IO" },
  { label: "Brunei Darussalam", value: "BN" },
  { label: "Bulgaria", value: "BG" },
  { label: "Burkina Faso", value: "BF" },
  { label: "Burundi", value: "BI" },
  { label: "Cambodia", value: "KH" },
  { label: "Cameroon", value: "CM" },
  { label: "Canada", value: "CA" },
  { label: "Cape Verde", value: "CV" },
  { label: "Cayman Islands", value: "KY" },
  { label: "Central African Republic", value: "CF" },
  { label: "Chad", value: "TD" },
  { label: "Chile", value: "CL" },
  { label: "China", value: "CN" },
  { label: "Christmas Island", value: "CX" },
  { label: "Cocos (Keeling) Islands", value: "CC" },
  { label: "Colombia", value: "CO" },
  { label: "Comoros", value: "KM" },
  { label: "Congo", value: "CG" },
  { label: "Congo, The Democratic Republic of the Congo", value: "CD" },
  { label: "Cook Islands", value: "CK" },
  { label: "Costa Rica", value: "CR" },
  { label: "Cote d'Ivoire", value: "CI" },
  { label: "Croatia", value: "HR" },
  { label: "Cuba", value: "CU" },
  { label: "Cyprus", value: "CY" },
  { label: "Czech Republic", value: "CZ" },
  { label: "Denmark", value: "DK" },
  { label: "Djibouti", value: "DJ" },
  { label: "Dominica", value: "DM" },
  { label: "Dominican Republic", value: "DO" },
  { label: "Ecuador", value: "EC" },
  { label: "Egypt", value: "EG" },
  { label: "El Salvador", value: "SV" },
  { label: "Equatorial Guinea", value: "GQ" },
  { label: "Eritrea", value: "ER" },
  { label: "Estonia", value: "EE" },
  { label: "Falkland Islands (Malvinas)", value: "FK" },
  { label: "Faroe Islands", value: "FO" },
  { label: "Fiji", value: "FJ" },
  { label: "Finland", value: "FI" },
  { label: "France", value: "FR" },
  { label: "French Guiana", value: "GF" },
  { label: "French Polynesia", value: "PF" },
  { label: "French Southern Territories", value: "TF" },
  { label: "Gabon", value: "GA" },
  { label: "Gambia", value: "GM" },
  { label: "Georgia", value: "GE" },
  { label: "Germany", value: "DE" },
  { label: "Ghana", value: "GH" },
  { label: "Gibraltar", value: "GI" },
  { label: "Greece", value: "GR" },
  { label: "Greenland", value: "GL" },
  { label: "Grenada", value: "GD" },
  { label: "Guadeloupe", value: "GP" },
  { label: "Guam", value: "GU" },
  { label: "Guatemala", value: "GT" },
  { label: "Guernsey", value: "GG" },
  { label: "Guinea", value: "GN" },
  { label: "Guinea-Bissau", value: "GW" },
  { label: "Guyana", value: "GY" },
  { label: "Haiti", value: "HT" },
  { label: "Heard Island and Mcdonald Islands", value: "HM" },
  { label: "Holy See (Vatican City State)", value: "VA" },
  { label: "Honduras", value: "HN" },
  { label: "Hong Kong", value: "HK" },
  { label: "Hungary", value: "HU" },
  { label: "Iceland", value: "IS" },
  { label: "India", value: "IN" },
  { label: "Indonesia", value: "ID" },
  { label: "Iran, Islamic Republic of Persian Gulf", value: "IR" },
  { label: "Iraq", value: "IQ" },
  { label: "Ireland", value: "IE" },
  { label: "Isle of Man", value: "IM" },
  { label: "Israel", value: "IL" },
  { label: "Italy", value: "IT" },
  { label: "Jamaica", value: "JM" },
  { label: "Japan", value: "JP" },
  { label: "Jersey", value: "JE" },
  { label: "Jordan", value: "JO" },
  { label: "Kazakhstan", value: "KZ" },
  { label: "Kenya", value: "KE" },
  { label: "Kiribati", value: "KI" },
  { label: "Korea, Democratic People's Republic of Korea", value: "KP" },
  { label: "Korea, Republic of South Korea", value: "KR" },
  { label: "Kosovo", value: "XK" },
  { label: "Kuwait", value: "KW" },
  { label: "Kyrgyzstan", value: "KG" },
  { label: "Laos", value: "LA" },
  { label: "Latvia", value: "LV" },
  { label: "Lebanon", value: "LB" },
  { label: "Lesotho", value: "LS" },
  { label: "Liberia", value: "LR" },
  { label: "Libyan Arab Jamahiriya", value: "LY" },
  { label: "Liechtenstein", value: "LI" },
  { label: "Lithuania", value: "LT" },
  { label: "Luxembourg", value: "LU" },
  { label: "Macao", value: "MO" },
  { label: "Macedonia", value: "MK" },
  { label: "Madagascar", value: "MG" },
  { label: "Malawi", value: "MW" },
  { label: "Malaysia", value: "MY" },
  { label: "Maldives", value: "MV" },
  { label: "Mali", value: "ML" },
  { label: "Malta", value: "MT" },
  { label: "Marshall Islands", value: "MH" },
  { label: "Martinique", value: "MQ" },
  { label: "Mauritania", value: "MR" },
  { label: "Mauritius", value: "MU" },
  { label: "Mayotte", value: "YT" },
  { label: "Mexico", value: "MX" },
  { label: "Micronesia, Federated States of Micronesia", value: "FM" },
  { label: "Moldova", value: "MD" },
  { label: "Monaco", value: "MC" },
  { label: "Mongolia", value: "MN" },
  { label: "Montenegro", value: "ME" },
  { label: "Montserrat", value: "MS" },
  { label: "Morocco", value: "MA" },
  { label: "Mozambique", value: "MZ" },
  { label: "Myanmar", value: "MM" },
  { label: "Namibia", value: "NA" },
  { label: "Nauru", value: "NR" },
  { label: "Nepal", value: "NP" },
  { label: "Netherlands", value: "NL" },
  { label: "Netherlands Antilles", value: "AN" },
  { label: "New Caledonia", value: "NC" },
  { label: "New Zealand", value: "NZ" },
  { label: "Nicaragua", value: "NI" },
  { label: "Niger", value: "NE" },
  { label: "Nigeria", value: "NG" },
  { label: "Niue", value: "NU" },
  { label: "Norfolk Island", value: "NF" },
  { label: "Northern Mariana Islands", value: "MP" },
  { label: "Norway", value: "NO" },
  { label: "Oman", value: "OM" },
  { label: "Pakistan", value: "PK" },
  { label: "Palau", value: "PW" },
  { label: "Palestinian Territory, Occupied", value: "PS" },
  { label: "Panama", value: "PA" },
  { label: "Papua New Guinea", value: "PG" },
  { label: "Paraguay", value: "PY" },
  { label: "Peru", value: "PE" },
  { label: "Philippines", value: "PH" },
  { label: "Pitcairn", value: "PN" },
  { label: "Poland", value: "PL" },
  { label: "Portugal", value: "PT" },
  { label: "Puerto Rico", value: "PR" },
  { label: "Qatar", value: "QA" },
  { label: "Reunion", value: "RE" },
  { label: "Romania", value: "RO" },
  { label: "Russia", value: "RU" },
  { label: "Rwanda", value: "RW" },
  { label: "Saint Barthelemy", value: "BL" },
  { label: "Saint Helena, Ascension and Tristan Da Cunha", value: "SH" },
  { label: "Saint Kitts and Nevis", value: "KN" },
  { label: "Saint Lucia", value: "LC" },
  { label: "Saint Martin", value: "MF" },
  { label: "Saint Pierre and Miquelon", value: "PM" },
  { label: "Saint Vincent and the Grenadines", value: "VC" },
  { label: "Samoa", value: "WS" },
  { label: "San Marino", value: "SM" },
  { label: "Sao Tome and Principe", value: "ST" },
  { label: "Saudi Arabia", value: "SA" },
  { label: "Senegal", value: "SN" },
  { label: "Serbia", value: "RS" },
  { label: "Seychelles", value: "SC" },
  { label: "Sierra Leone", value: "SL" },
  { label: "Singapore", value: "SG" },
  { label: "Slovakia", value: "SK" },
  { label: "Slovenia", value: "SI" },
  { label: "Solomon Islands", value: "SB" },
  { label: "Somalia", value: "SO" },
  { label: "South Africa", value: "ZA" },
  { label: "South Georgia and the South Sandwich Islands", value: "GS" },
  { label: "South Sudan", value: "SS" },
  { label: "Spain", value: "ES" },
  { label: "Sri Lanka", value: "LK" },
  { label: "Sudan", value: "SD" },
  { label: "Suriname", value: "SR" },
  { label: "Svalbard and Jan Mayen", value: "SJ" },
  { label: "Swaziland", value: "SZ" },
  { label: "Sweden", value: "SE" },
  { label: "Switzerland", value: "CH" },
  { label: "Syrian Arab Republic", value: "SY" },
  { label: "Taiwan", value: "TW" },
  { label: "Tajikistan", value: "TJ" },
  { label: "Tanzania, United Republic of Tanzania", value: "TZ" },
  { label: "Thailand", value: "TH" },
  { label: "Timor-Leste", value: "TL" },
  { label: "Togo", value: "TG" },
  { label: "Tokelau", value: "TK" },
  { label: "Tonga", value: "TO" },
  { label: "Trinidad and Tobago", value: "TT" },
  { label: "Tunisia", value: "TN" },
  { label: "Turkey", value: "TR" },
  { label: "Turkmenistan", value: "TM" },
  { label: "Turks and Caicos Islands", value: "TC" },
  { label: "Tuvalu", value: "TV" },
  { label: "Uganda", value: "UG" },
  { label: "Ukraine", value: "UA" },
  { label: "United Arab Emirates", value: "AE" },
  { label: "United Kingdom", value: "GB" },
  { label: "United States", value: "US" },
  { label: "Uruguay", value: "UY" },
  { label: "Uzbekistan", value: "UZ" },
  { label: "Vanuatu", value: "VU" },
  { label: "Venezuela, Bolivarian Republic of Venezuela", value: "VE" },
  { label: "Vietnam", value: "VN" },
  { label: "Virgin Islands, British", value: "VG" },
  { label: "Virgin Islands, U.S.", value: "VI" },
  { label: "Wallis and Futuna", value: "WF" },
  { label: "Yemen", value: "YE" },
  { label: "Zambia", value: "ZM" },
];

const AIRLINES = [
  { label: "Air Arabia", value: "G9" },
  { label: "Air Austral", value: "UU" },
  { label: "Air Botswana", value: "BP" },
  { label: "Air Canada", value: "AC" },
  { label: "Air China", value: "CA" },
  { label: "Air France", value: "AF" },
  { label: "Air India", value: "AI" },
  { label: "Air Algerie", value: "AH" },
  { label: "Aegean Airlines", value: "A3" },
  { label: "Alaska Airlines", value: "AS" },
  { label: "American Airlines", value: "AA" },
  { label: "ASKY Airlines", value: "KP" },
  { label: "Badr Airlines", value: "J4" },
  { label: "British Airways", value: "BA" },
  { label: "China Eastern Airlines", value: "MU" },
  { label: "China Southern Airlines", value: "CZ" },
  { label: "Delta Air Lines", value: "DL" },
  { label: "EgyptAir", value: "MS" },
  { label: "Emirates", value: "EK" },
  { label: "Ethiopian Airlines", value: "ET" },
  { label: "Flydubai", value: "FZ" },
  { label: "Flynas", value: "XY" },
  { label: "Gulf Air", value: "GF" },
  { label: "Iberia", value: "IB" },
  { label: "IndiGo", value: "6E" },
  { label: "ITA Airways", value: "AZ" },
  { label: "Japan Airlines", value: "JL" },
  { label: "Jazeera Airways", value: "J9" },
  { label: "JetBlue Airways", value: "B6" },
  { label: "Kenya Airways", value: "KQ" },
  { label: "KLM", value: "KL" },
  { label: "Korean Air", value: "KE" },
  { label: "Kuwait Airways", value: "KU" },
  { label: "LATAM Airlines Group SA", value: "LA" },
  { label: "Lufthansa", value: "LH" },
  { label: "National Airways Ethiopia", value: "9Y" },
  { label: "Pakistan International Airlines", value: "PK" },
  { label: "Qantas", value: "QF" },
  { label: "Qatar Airways", value: "QR" },
  { label: "Saudia", value: "SV" },
  { label: "Shenzhen Airlines", value: "ZH" },
  { label: "Singapore Airlines", value: "SQ" },
  { label: "SriLankan Airlines", value: "UL" },
  { label: "Turkish Airlines", value: "TK" },
  { label: "Other", value: "OTHER" },
];

const SYMPTOMS = [
  { code: "FEVER", label: "Fever (>38.5°C/101.3°F) or recent history of fever" },
  { code: "HEADACHE", label: "Headache" },
  { code: "RASH", label: "Skin rash" },
  { code: "MUCOSAL", label: "Mucosal lesions / lymphadenopathy" },
  { code: "BACKPAIN", label: "Back pain" },
  { code: "MYALGIA", label: "Myalgia (muscle/body aches)" },
  { code: "FATIGUE", label: "Fatigue / weakness" },
  { code: "RECTAL", label: "Rectal pain or bleeding" },
  { code: "BLOODY", label: "Bloody diarrhea / purpura" },
  { code: "EYES_URINE", label: "Bleeding into eyes or urine" },
];

// ====== Full ordered nationalities list (label shown in UI, value sent to DHIS2) ======
const NATIONALITIES = [
  { label: "Ethiopia", value: "ET" },
  { label: "Afghanistan", value: "AF" },
  { label: "Aland Islands", value: "AX" },
  { label: "Albania", value: "AL" },
  { label: "Algeria", value: "DZ" },
  { label: "American Samoa", value: "AS" },
  { label: "Andorra", value: "AD" },
  { label: "Angola", value: "AO" },
  { label: "Anguilla", value: "AI" },
  { label: "Antarctica", value: "AQ" },
  { label: "Antigua and Barbuda", value: "AG" },
  { label: "Argentina", value: "AR" },
  { label: "Armenia", value: "AM" },
  { label: "Aruba", value: "AW" },
  { label: "Australia", value: "AU" },
  { label: "Austria", value: "AT" },
  { label: "Azerbaijan", value: "AZ" },
  { label: "Bahamas", value: "BS" },
  { label: "Bahrain", value: "BH" },
  { label: "Bangladesh", value: "BD" },
  { label: "Barbados", value: "BB" },
  { label: "Belarus", value: "BY" },
  { label: "Belgium", value: "BE" },
  { label: "Belize", value: "BZ" },
  { label: "Benin", value: "BJ" },
  { label: "Bermuda", value: "BM" },
  { label: "Bhutan", value: "BT" },
  { label: "Bolivia, Plurinational State of bolivia", value: "BO" },
  { label: "Bosnia and Herzegovina", value: "BA" },
  { label: "Botswana", value: "BW" },
  { label: "Bouvet Island", value: "BV" },
  { label: "Brazil", value: "BR" },
  { label: "British Indian Ocean Territory", value: "IO" },
  { label: "Brunei Darussalam", value: "BN" },
  { label: "Bulgaria", value: "BG" },
  { label: "Burkina Faso", value: "BF" },
  { label: "Burundi", value: "BI" },
  { label: "Cambodia", value: "KH" },
  { label: "Cameroon", value: "CM" },
  { label: "Canada", value: "CA" },
  { label: "Cape Verde", value: "CV" },
  { label: "Cayman Islands", value: "KY" },
  { label: "Central African Republic", value: "CF" },
  { label: "Chad", value: "TD" },
  { label: "Chile", value: "CL" },
  { label: "China", value: "CN" },
  { label: "Christmas Island", value: "CX" },
  { label: "Cocos (Keeling) Islands", value: "CC" },
  { label: "Colombia", value: "CO" },
  { label: "Comoros", value: "KM" },
  { label: "Congo", value: "CG" },
  { label: "Congo, The Democratic Republic of the Congo", value: "CD" },
  { label: "Cook Islands", value: "CK" },
  { label: "Costa Rica", value: "CR" },
  { label: "Cote d'Ivoire", value: "CI" },
  { label: "Croatia", value: "HR" },
  { label: "Cuba", value: "CU" },
  { label: "Cyprus", value: "CY" },
  { label: "Czech Republic", value: "CZ" },
  { label: "Denmark", value: "DK" },
  { label: "Djibouti", value: "DJ" },
  { label: "Dominica", value: "DM" },
  { label: "Dominican Republic", value: "DO" },
  { label: "Ecuador", value: "EC" },
  { label: "Egypt", value: "EG" },
  { label: "El Salvador", value: "SV" },
  { label: "Equatorial Guinea", value: "GQ" },
  { label: "Eritrea", value: "ER" },
  { label: "Estonia", value: "EE" },
  { label: "Falkland Islands (Malvinas)", value: "FK" },
  { label: "Faroe Islands", value: "FO" },
  { label: "Fiji", value: "FJ" },
  { label: "Finland", value: "FI" },
  { label: "France", value: "FR" },
  { label: "French Guiana", value: "GF" },
  { label: "French Polynesia", value: "PF" },
  { label: "French Southern Territories", value: "TF" },
  { label: "Gabon", value: "GA" },
  { label: "Gambia", value: "GM" },
  { label: "Georgia", value: "GE" },
  { label: "Germany", value: "DE" },
  { label: "Ghana", value: "GH" },
  { label: "Gibraltar", value: "GI" },
  { label: "Greece", value: "GR" },
  { label: "Greenland", value: "GL" },
  { label: "Grenada", value: "GD" },
  { label: "Guadeloupe", value: "GP" },
  { label: "Guam", value: "GU" },
  { label: "Guatemala", value: "GT" },
  { label: "Guernsey", value: "GG" },
  { label: "Guinea", value: "GN" },
  { label: "Guinea-Bissau", value: "GW" },
  { label: "Guyana", value: "GY" },
  { label: "Haiti", value: "HT" },
  { label: "Heard Island and Mcdonald Islands", value: "HM" },
  { label: "Holy See (Vatican City State)", value: "VA" },
  { label: "Honduras", value: "HN" },
  { label: "Hong Kong", value: "HK" },
  { label: "Hungary", value: "HU" },
  { label: "Iceland", value: "IS" },
  { label: "India", value: "IN" },
  { label: "Indonesia", value: "ID" },
  { label: "Iran, Islamic Republic of Persian Gulf", value: "IR" },
  { label: "Iraq", value: "IQ" },
  { label: "Ireland", value: "IE" },
  { label: "Isle of Man", value: "IM" },
  { label: "Israel", value: "IL" },
  { label: "Italy", value: "IT" },
  { label: "Jamaica", value: "JM" },
  { label: "Japan", value: "JP" },
  { label: "Jersey", value: "JE" },
  { label: "Jordan", value: "JO" },
  { label: "Kazakhstan", value: "KZ" },
  { label: "Kenya", value: "KE" },
  { label: "Kiribati", value: "KI" },
  { label: "Korea, Democratic People's Republic of Korea", value: "KP" },
  { label: "Korea, Republic of South Korea", value: "KR" },
  { label: "Kosovo", value: "XK" },
  { label: "Kuwait", value: "KW" },
  { label: "Kyrgyzstan", value: "KG" },
  { label: "Laos", value: "LA" },
  { label: "Latvia", value: "LV" },
  { label: "Lebanon", value: "LB" },
  { label: "Lesotho", value: "LS" },
  { label: "Liberia", value: "LR" },
  { label: "Libyan Arab Jamahiriya", value: "LY" },
  { label: "Liechtenstein", value: "LI" },
  { label: "Lithuania", value: "LT" },
  { label: "Luxembourg", value: "LU" },
  { label: "Macao", value: "MO" },
  { label: "Macedonia", value: "MK" },
  { label: "Madagascar", value: "MG" },
  { label: "Malawi", value: "MW" },
  { label: "Malaysia", value: "MY" },
  { label: "Maldives", value: "MV" },
  { label: "Mali", value: "ML" },
  { label: "Malta", value: "MT" },
  { label: "Marshall Islands", value: "MH" },
  { label: "Martinique", value: "MQ" },
  { label: "Mauritania", value: "MR" },
  { label: "Mauritius", value: "MU" },
  { label: "Mayotte", value: "YT" },
  { label: "Mexico", value: "MX" },
  { label: "Micronesia, Federated States of Micronesia", value: "FM" },
  { label: "Moldova", value: "MD" },
  { label: "Monaco", value: "MC" },
  { label: "Mongolia", value: "MN" },
  { label: "Montenegro", value: "ME" },
  { label: "Montserrat", value: "MS" },
  { label: "Morocco", value: "MA" },
  { label: "Mozambique", value: "MZ" },
  { label: "Myanmar", value: "MM" },
  { label: "Namibia", value: "NA" },
  { label: "Nauru", value: "NR" },
  { label: "Nepal", value: "NP" },
  { label: "Netherlands", value: "NL" },
  { label: "Netherlands Antilles", value: "AN" },
  { label: "New Caledonia", value: "NC" },
  { label: "New Zealand", value: "NZ" },
  { label: "Nicaragua", value: "NI" },
  { label: "Niger", value: "NE" },
  { label: "Nigeria", value: "NG" },
  { label: "Niue", value: "NU" },
  { label: "Norfolk Island", value: "NF" },
  { label: "Northern Mariana Islands", value: "MP" },
  { label: "Norway", value: "NO" },
  { label: "Oman", value: "OM" },
  { label: "Pakistan", value: "PK" },
  { label: "Palau", value: "PW" },
  { label: "Palestinian Territory, Occupied", value: "PS" },
  { label: "Panama", value: "PA" },
  { label: "Papua New Guinea", value: "PG" },
  { label: "Paraguay", value: "PY" },
  { label: "Peru", value: "PE" },
  { label: "Philippines", value: "PH" },
  { label: "Pitcairn", value: "PN" },
  { label: "Poland", value: "PL" },
  { label: "Portugal", value: "PT" },
  { label: "Puerto Rico", value: "PR" },
  { label: "Qatar", value: "QA" },
  { label: "Reunion", value: "RE" },
  { label: "Romania", value: "RO" },
  { label: "Russia", value: "RU" },
  { label: "Rwanda", value: "RW" },
  { label: "Saint Barthelemy", value: "BL" },
  { label: "Saint Helena, Ascension and Tristan Da Cunha", value: "SH" },
  { label: "Saint Kitts and Nevis", value: "KN" },
  { label: "Saint Lucia", value: "LC" },
  { label: "Saint Martin", value: "MF" },
  { label: "Saint Pierre and Miquelon", value: "PM" },
  { label: "Saint Vincent and the Grenadines", value: "VC" },
  { label: "Samoa", value: "WS" },
  { label: "San Marino", value: "SM" },
  { label: "Sao Tome and Principe", value: "ST" },
  { label: "Saudi Arabia", value: "SA" },
  { label: "Senegal", value: "SN" },
  { label: "Serbia", value: "RS" },
  { label: "Seychelles", value: "SC" },
  { label: "Sierra Leone", value: "SL" },
  { label: "Singapore", value: "SG" },
  { label: "Slovakia", value: "SK" },
  { label: "Slovenia", value: "SI" },
  { label: "Solomon Islands", value: "SB" },
  { label: "Somalia", value: "SO" },
  { label: "South Africa", value: "ZA" },
  { label: "South Georgia and the South Sandwich Islands", value: "GS" },
  { label: "South Sudan", value: "SS" },
  { label: "Spain", value: "ES" },
  { label: "Sri Lanka", value: "LK" },
  { label: "Sudan", value: "SD" },
  { label: "Suriname", value: "SR" },
  { label: "Svalbard and Jan Mayen", value: "SJ" },
  { label: "Swaziland", value: "SZ" },
  { label: "Sweden", value: "SE" },
  { label: "Switzerland", value: "CH" },
  { label: "Syrian Arab Republic", value: "SY" },
  { label: "Taiwan", value: "TW" },
  { label: "Tajikistan", value: "TJ" },
  { label: "Tanzania, United Republic of Tanzania", value: "TZ" },
  { label: "Thailand", value: "TH" },
  { label: "Timor-Leste", value: "TL" },
  { label: "Togo", value: "TG" },
  { label: "Tokelau", value: "TK" },
  { label: "Tonga", value: "TO" },
  { label: "Trinidad and Tobago", value: "TT" },
  { label: "Tunisia", value: "TN" },
  { label: "Turkey", value: "TR" },
  { label: "Turkmenistan", value: "TM" },
  { label: "Turks and Caicos Islands", value: "TC" },
  { label: "Tuvalu", value: "TV" },
  { label: "Uganda", value: "UG" },
  { label: "Ukraine", value: "UA" },
  { label: "United Arab Emirates", value: "AE" },
  { label: "United Kingdom", value: "GB" },
  { label: "United States", value: "US" },
  { label: "Uruguay", value: "UY" },
  { label: "Uzbekistan", value: "UZ" },
  { label: "Vanuatu", value: "VU" },
  { label: "Venezuela, Bolivarian Republic of Venezuela", value: "VE" },
  { label: "Vietnam", value: "VN" },
  { label: "Virgin Islands, British", value: "VG" },
  { label: "Virgin Islands, U.S.", value: "VI" },
  { label: "Wallis and Futuna", value: "WF" },
  { label: "Yemen", value: "YE" },
  { label: "Zambia", value: "ZM" },
];

// Translations
const STRINGS = {
  en: {
    title: "Traveler Health Declaration Form",
    readmoreintro: "Traveler Declaration is a self-declaration form.",
    readmore: "To protect your health, your family, and the community, the Federal Democratic Republic of Ethiopia Ministry of Health / Ethiopian Public Health Institute / Travlers and Border Health Directorate requires you to complete this form. This information is collected as part of a Cross Border communicable disease control measures. Your information will be held confidential and used only for public health measure purposes."
  },
  fr: {
    title: "Formulaire de déclaration de santé du voyageur",
    readmoreintro: "La déclaration du voyageur est un formulaire d'auto-déclaration.",
    readmore: "Pour protéger votre santé, celle de votre famille et de la communauté, la République fédérale démocratique d'Éthiopie / Institut éthiopien de santé publique / Direction des voyageurs et de la santé frontalière vous demande de remplir ce formulaire. Ces informations sont collectées dans le cadre des mesures de contrôle des maladies transmissibles transfrontalières. Vos informations resteront confidentielles et ne seront utilisées qu’à des fins de santé publique."
  },
  am: {
    title: "የተጓዥ ጤና መግለጫ ቅፅ",
    readmoreintro: "የተጓዥ መግለጫ የራስ መግለጫ ቅፅ ነው።",
    readmore: "የእርስዎን ጤና፣ የቤተሰቦ ጤና እና የማህበረሰቡን ጤና ለመጠበቅ፣ የኢትዮጵያ ፌዴራል ዴሞክራቲክ ሪፐብሊክ የጤና ሚኒስቴር / የኢትዮጵያ ሕዝብ ጤና ኢንስቲትዩት / የተጓዥና የድንበር ጤና ዳይሬክቶሬት ይህን ቅፅ እንዲሞሉ ይጠይቃል። ይህ መረጃ እንደ አንድ ከድንበር በሽታ ቁጥጥር እርምጃዎች የተሰበሰበ ነው። የእርስዎ መረጃ በሚገባ ይጠበቃል እና በህዝብ ጤና እርምጃዎች ብቻ ይጠቀማል።"
  }
};


// ====== Reusable UI components ======

function TopBar({
  lang,
  setLang,
}: {
  lang: "en" | "fr" | "am";
  setLang: (l: "en" | "fr" | "am") => void;
}) {
  return (
    <header className="relative bg-white/80 backdrop-blur shadow-sm">
      <img
        src={FLAG_BG_URL}
        alt="Ethiopia flag background"
        className="absolute inset-0 w-full h-full object-cover opacity-50"
      />
      <div className="relative flex items-center max-w-7xl mx-auto p-4">
        {/* Logos */}
        <div className="flex items-center gap-4">
          <img
            src={MOH_LOGO_URL}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.src = MOH_LOGO_FALLBACK;
            }}
            alt="MoH logo"
            className="h-12 w-auto"
          />
          <img src={EPHI_LOGO_URL} alt="EPHI logo" className="h-12 w-auto" />
        </div>
        {/* Title centered */}
        <div className="flex-1 text-center">
          <h1 className="text-emerald-700 text-xl font-semibold">Traveler Health Declaration Form</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setLang("en")} title="English" aria-label="English">
            <img src="https://flagcdn.com/w20/gb.png" alt="English" className="h-4 w-6 rounded-sm border" />
          </button>
          <button onClick={() => setLang("fr")} title="Français" aria-label="Français">
            <img src="https://flagcdn.com/w20/fr.png" alt="Français" className="h-4 w-6 rounded-sm border" />
          </button>
          <button onClick={() => setLang("am")} title="አማርኛ" aria-label="Amharic">
            <img src="https://flagcdn.com/w20/et.png" alt="Amharic" className="h-4 w-6 rounded-sm border" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl p-6 shadow-sm">{children}</div>;
}

function Field({ label, children, required = false, error }: { label: string; children: React.ReactNode; required?: boolean; error?: string; }) {
  return (
    <div className="space-y-1">
      <label className="block font-medium text-gray-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
}

function ProgressBar({ current }: { current: number }) {
  const stages = ["Personal", "Travel", "Clinical", "Summary"];
  return (
    <div className="flex gap-3 mb-6">
      {stages.map((s, idx) => (
        <div key={idx} className="flex-1 h-2 rounded-full" style={{ backgroundColor: idx <= current ? '#059669' : '#d1d5db' }} />
      ))}
    </div>
  );
}

// A basic combobox that allows typing to filter options
function SearchableSelect({ options, value, onChange, placeholder }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void; placeholder?: string; }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = query === "" ? options : options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const selectedLabel = options.find((o) => o.value === value)?.label || "";
  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
        placeholder={placeholder || "Select..."}
        value={open ? query : selectedLabel}
        onFocus={() => setOpen(true)}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 && <div className="p-2 text-gray-500">No options</div>}
          {filtered.map((opt, idx) => (
            <div
              // Use value-index as key to avoid duplicate key warnings if codes repeat
              key={`${opt.value}-${idx}`}
              onMouseDown={() => {
                onChange(opt.value);
                setOpen(false);
                setQuery("");
              }}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Footer component displayed on the home page. It provides helpful links and
// credits, similar to typical government websites. The colours are aligned
// with the site's green theme. The DHIS2 logo is loaded from the official
// site; if the image fails to load, the alt text will appear instead.
function Footer() {
  return (
    <footer className="bg-emerald-800 text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap justify-center gap-8 text-sm">
          <a href="#" className="hover:underline">Help &amp; contact us</a>
          <a href="#" className="hover:underline">Terms of use</a>
          <a href="#" className="hover:underline">Privacy</a>
          <a href="#" className="hover:underline">About this site</a>
        </div>
        <hr className="my-4 border-white/30" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <span>© Ethiopian Public Health Institute (EPHI)</span>
          <span className="flex items-center gap-1">
            Powered by
            <img
              src="https://docs.dhis2.org/en/full/resources/images/dhis2-logo-rgb-positive.png"
              alt="DHIS2"
              className="h-4 w-auto"
            />
          </span>
        </div>
      </div>
    </footer>
  );
}

// ====== Form steps ======

function PersonalForm({ data, errors, update, next, cancel }: { data: any; errors: Record<string, string>; update: (f: string, v: any) => void; next: () => void; cancel: () => void; }) {
  const age = useMemo(() => {
    if (!data.dob) return null;
    const d = new Date(data.dob);
    if (isNaN(d as any)) return null as any;
    const now = new Date();
    let y = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) y--;
    return y;
  }, [data.dob]);
  const isMinor = age !== null && (age as number) < 18;
  return (
    <div className="max-w-5xl mx-auto p-4">
      <Card>
        <ProgressBar current={0} />
        <h2 className="text-2xl font-bold mb-6">Personal Details</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Field label="First Name" required error={errors.firstName}>
            <input
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.firstName || ""}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </Field>
          <Field label="Middle Name" error={errors.middleName}>
            <input
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.middleName || ""}
              onChange={(e) => update("middleName", e.target.value)}
            />
          </Field>
          <Field label="Last Name" required error={errors.lastName}>
            <input
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.lastName || ""}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </Field>
          <Field label="Date of Birth" required error={errors.dob}>
            <input
              type="date"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.dob || ""}
              onChange={(e) => update("dob", e.target.value)}
            />
          </Field>
          <Field label="Sex" required error={errors.sex}>
            <select
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.sex || ""}
              onChange={(e) => update("sex", e.target.value)}
            >
              <option value="">-- select --</option>
              {SEX_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone Number" required error={errors.phone}>
            <input
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.phone || ""}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
          <Field label="Nationality" required error={errors.nationality}>
            <SearchableSelect
              options={COUNTRY_LIST}
              value={data.nationality || ""}
              onChange={(v) => update("nationality", v)}
              placeholder="Type to search nationality..."
            />
          </Field>
          <Field label="Passport / Laissez-passer" required error={errors.passport}>
            <input
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.passport || ""}
              onChange={(e) => update("passport", e.target.value)}
            />
          </Field>
        </div>
        {isMinor && (
          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <Field label="Guardian Name" required error={errors.guardianName}>
              <input
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                value={data.guardianName || ""}
                onChange={(e) => update("guardianName", e.target.value)}
              />
            </Field>
            <Field label="Guardian Phone" required error={errors.guardianPhone}>
              <input
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                value={data.guardianPhone || ""}
                onChange={(e) => update("guardianPhone", e.target.value)}
              />
            </Field>
          </div>
        )}
        <div className="flex justify-between mt-8">
          <button type="button" onClick={() => cancel && cancel()} className="px-6 py-3 rounded-2xl border border-red-600 bg-red-50 text-red-700 text-lg">
            Cancel
          </button>
          <button type="button" onClick={next} className="px-8 py-3 rounded-2xl bg-emerald-700 text-white text-lg">
            Next
          </button>
        </div>
      </Card>
    </div>
  );
}

function TravelForm({ data, errors, update, toggleVisited, back, next, cancel, countriesOptions }: { data: any; errors: Record<string, string>; update: (f: string, v: any) => void; toggleVisited: (c: string) => void; back: () => void; next: () => void; cancel: () => void; countriesOptions: { label: string; value: string }[]; }) {
  return (
    <div className="max-w-5xl mx-auto p-4">
      <Card>
        <ProgressBar current={1} />
        <h2 className="text-2xl font-bold mb-6">Travel Details</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Field label="Purpose of travel to Ethiopia" required error={errors.purpose}>
            <select
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.purpose || ""}
              onChange={(e) => update("purpose", e.target.value)}
            >
              <option value="">-- select --</option>
              {PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Air Line Name" required error={errors.airline}>
            <select
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.airline || ""}
              onChange={(e) => update("airline", e.target.value)}
            >
              <option value="">-- select --</option>
              {AIRLINES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          {data.airline === "OTHER" && (
            <Field label="Other airline">
              <input
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                value={data.otherAirline || ""}
                onChange={(e) => update("otherAirline", e.target.value)}
              />
            </Field>
          )}
          <Field label="Flight Number" required error={errors.flightNumber}>
            <div className="flex gap-2 items-center">
              {/* Airline code box: always disabled and displays selected airline code */}
              <input
                className="w-20 rounded-2xl border border-gray-300 px-4 py-3 text-lg text-center bg-gray-100"
                value={data.airline && data.airline !== 'OTHER' ? data.airline : ''}
                disabled
              />
              {/* Flight number input: numeric only */}
              <input
                className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                value={data.flightNumber || ''}
                onChange={(e) => update('flightNumber', e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                pattern="[0-9]*"
                title="Numbers only"
              />
            </div>
          </Field>
          <Field label="Seat Number" required error={errors.seatNumber}>
            <input
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.seatNumber || ""}
              onChange={(e) => update("seatNumber", e.target.value)}
            />
          </Field>
          <Field label="Departure Country" required error={errors.departureCountry}>
            <SearchableSelect
              options={COUNTRY_LIST}
              value={data.departureCountry || ""}
              onChange={(v) => update("departureCountry", v)}
              placeholder="Type to search country..."
            />
          </Field>
          <Field label="Departure City">
            <input
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.departureCity || ""}
              onChange={(e) => update("departureCity", e.target.value)}
            />
          </Field>
          <Field label="Arrival Date" required error={errors.arrivalDate}>
            <input
              type="date"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
              value={data.arrivalDate || ""}
              onChange={(e) => update("arrivalDate", e.target.value)}
            />
          </Field>
          {/* Removed "Place of Stay" field. The current DHIS2 workflow no longer
             collects this information, so we omit the input entirely. */}
        </div>
        <div className="mt-8">
          <Field label="Countries visited in the last 21 days (select all that apply)">
            <div className="grid md:grid-cols-2 gap-2">
              {countriesOptions.map((c) => (
                <label key={c.value} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border">
                  <input
                    type="checkbox"
                    checked={data.visitedList.includes(c.value)}
                    onChange={() => toggleVisited(c.value)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-between items-center mt-8">
          <button type="button" onClick={() => cancel && cancel()} className="px-6 py-3 rounded-2xl border border-red-600 bg-red-50 text-red-700 text-lg">
            Cancel
          </button>
          <div className="flex gap-4">
            <button type="button" onClick={back} className="px-6 py-3 rounded-2xl border border-gray-300 text-lg">
              Back
            </button>
            <button type="button" onClick={next} className="px-8 py-3 rounded-2xl bg-emerald-700 text-white text-lg">
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ClinicalForm({ data, updateClinical, back, next, cancel, clinicalElements, errors }: { data: any; updateClinical: (id: string, value: any) => void; back: () => void; next: () => void; cancel: () => void; clinicalElements: any[]; errors: Record<string, string>; }) {
  return (
    <div className="max-w-5xl mx-auto p-4">
      <Card>
        <ProgressBar current={2} />
        <h2 className="text-2xl font-bold mb-6">Clinical Data</h2>
        {/* Render each clinical question. We add extra margin-top (mt-4) to separate
            questions visually. */}
        {clinicalElements.map((el) => {
          const questionId = el.id;
          const answer = data.clinicalData[questionId] || "";
          return (
            <div key={questionId} className="mt-4">
              <Field label={el.formName} required={el.compulsory} error={errors[questionId]}>
                {/* If an option set is provided, render as radio group. */}
                {el.optionSet && el.optionSet.options && el.optionSet.options.length > 0 ? (
                  <div className="flex flex-wrap gap-4">
                    {el.optionSet.options.map((opt: any) => (
                      <label key={opt.code} className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`sym-${questionId}`}
                          checked={answer === opt.code}
                          onChange={() => updateClinical(questionId, opt.code)}
                        />
                        <span>{opt.name}</span>
                      </label>
                    ))}
                  </div>
                ) : el.valueType && (el.valueType === 'BOOLEAN' || el.valueType === 'TRUE_ONLY') ? (
                  // Boolean questions: show Yes/No radio buttons
                  <div className="flex gap-6">
                    {[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }].map((opt) => (
                      <label key={opt.value} className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`sym-${questionId}`}
                          checked={answer === opt.value}
                          onChange={() => updateClinical(questionId, opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  // Default: text input
                  <input
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                    value={answer}
                    onChange={(e) => updateClinical(questionId, e.target.value)}
                  />
                )}
              </Field>
            </div>
          );
        })}
        <div className="flex justify-between items-center mt-8">
          <button type="button" onClick={() => cancel && cancel()} className="px-6 py-3 rounded-2xl border border-red-600 bg-red-50 text-red-700 text-lg">
            Cancel
          </button>
          <div className="flex gap-4">
            <button type="button" onClick={back} className="px-6 py-3 rounded-2xl border border-gray-300 text-lg">
              Back
            </button>
            <button type="button" onClick={next} className="px-8 py-3 rounded-2xl bg-emerald-700 text-white text-lg">
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SummaryView({
  data, countriesOptions, clinicalElements, onBack, onSubmit, cancel,
  agreeLegal, triedSubmit, setAgreeLegal
}: {
  data: any;
  countriesOptions: { label: string; value: string }[];
  clinicalElements: any[];
  onBack: () => void;
  onSubmit: () => void;
  cancel: () => void;
  agreeLegal: boolean;
  triedSubmit: boolean;
  setAgreeLegal: (v: boolean) => void;
}) {
  // Map visited country codes to labels
  const countryMap = useMemo(() => {
    const m: Record<string, string> = {};
    countriesOptions.forEach((c) => {
      m[c.value] = c.label;
    });
    return m;
  }, [countriesOptions]);
  // Map clinical element id to formName and option labels
  const clinicalMap = useMemo(() => {
    const m: Record<string, any> = {};
    clinicalElements.forEach((el) => {
      const optMap: Record<string, string> = {};
      if (el.optionSet && el.optionSet.options) {
        el.optionSet.options.forEach((o: any) => {
          optMap[o.code] = o.name;
        });
      }
      m[el.id] = { name: el.formName, options: optMap, valueType: el.valueType };
    });
    return m;
  }, [clinicalElements]);
  return (
    <div className="max-w-5xl mx-auto p-4">
      <Card>
        <ProgressBar current={3} />
        <h2 className="text-2xl font-bold mb-6">Summary</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-2">Personal</h3>
            <div className="grid md:grid-cols-2 gap-y-2">
              <div><strong>First Name:</strong> {data.firstName}</div>
              <div><strong>Middle Name:</strong> {data.middleName}</div>
              <div><strong>Last Name:</strong> {data.lastName}</div>
              <div><strong>Date of Birth:</strong> {data.dob}</div>
              <div><strong>Sex:</strong> {SEX_OPTIONS.find((s) => s.value === data.sex)?.label || data.sex}</div>
              <div><strong>Phone:</strong> {data.phone}</div>
              <div><strong>Passport:</strong> {data.passport}</div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Travel</h3>
            <div className="grid md:grid-cols-2 gap-y-2">
              <div><strong>Purpose:</strong> {PURPOSES.find((p) => p.value === data.purpose)?.label || data.purpose}</div>
              <div><strong>Airline:</strong> {AIRLINES.find((a) => a.value === data.airline)?.label || data.airline}</div>
              {data.airline === "OTHER" && <div><strong>Other Airline:</strong> {data.otherAirline}</div>}
              <div><strong>Flight Number:</strong> {data.flightNumber}</div>
              <div><strong>Seat Number:</strong> {data.seatNumber}</div>
              <div><strong>Nationality:</strong> {COUNTRY_LIST.find((n) => n.value === data.nationality)?.label || data.nationality}</div>
              <div><strong>Departure Country:</strong> {COUNTRY_LIST.find((n) => n.value === data.departureCountry)?.label || data.departureCountry}</div>
              <div><strong>Departure City:</strong> {data.departureCity}</div>
              <div><strong>Arrival Date:</strong> {data.arrivalDate}</div>
              {/* Place of Stay removed from summary; this field is no longer collected */}
              <div className="md:col-span-2"><strong>Countries Visited:</strong> {data.visitedList.map((c: string) => countryMap[c]).filter(Boolean).join(", ")}</div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Clinical Data</h3>
            <div className="space-y-2">
              {clinicalElements.map((el) => {
                const value = data.clinicalData[el.id];
                let label: any = value;
                // If there is an options map, use it
                if (value && clinicalMap[el.id] && Object.keys(clinicalMap[el.id].options || {}).length > 0) {
                  const optLabel = clinicalMap[el.id].options[value];
                  label = optLabel || value;
                } else if (clinicalMap[el.id]?.valueType && (clinicalMap[el.id].valueType === 'BOOLEAN' || clinicalMap[el.id].valueType === 'TRUE_ONLY')) {
                  // For boolean value types, map true/false to Yes/No
                  if (value === 'true' || value === true) label = 'Yes';
                  else if (value === 'false' || value === false) label = 'No';
                }
                return (
                  <div key={el.id} className="flex justify-between">
                    <span className="font-medium">{el.formName}:</span>
                    <span>{label || "--"}</span>
                  </div>
                );
              })}
              {/* Other symptoms are included in clinicalData (NoCXFMxcfT3) so no separate field here */}
            </div>
          </div>
          <div>
            <label className="flex items-start gap-2 mt-4">
            <input
              type="checkbox"
              checked={agreeLegal}
              onChange={(e) => setAgreeLegal(e.target.checked)}
            />
            <span className="text-sm">
              I hereby declare the information provided is true and correct. I understand
              that any false or misleading information may result in legal action.
            </span>
          </label>
          {triedSubmit && !agreeLegal && (
            <div className="error mt-2">You must accept the declaration to submit.</div>
          )}
          </div>
        </div>
        <div className="flex justify-between items-center mt-8">
          <button onClick={() => cancel && cancel()} className="px-6 py-3 rounded-2xl border border-red-600 bg-red-50 text-red-700 text-lg">Cancel</button>
          <div className="flex gap-4">
            <button onClick={onBack} className="px-6 py-3 rounded-2xl border border-gray-300 text-lg">Back</button>
            <button onClick={onSubmit} className="px-8 py-3 rounded-2xl bg-emerald-700 text-white text-lg">Submit</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ====== Main App ======
export default function App() {
  // Views for the main router. We renamed the "landing" view to "home"
  type View = "home" | "form" | "summary" | "complete" | "edit" | "qr";
  const [view, setView] = useState<View>("home");
  const [step, setStep] = useState(0);
  const [showReadMore, setShowReadMore] = useState(false);

  // Dynamic metadata
  const [countriesOptions, setCountriesOptions] = useState<{ label: string; value: string }[]>([]);
  const [clinicalElements, setClinicalElements] = useState<any[]>([]);

  // Legal disclaimer
  const [agreeLegal, setAgreeLegal] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);

  // Languages supported
  const [lang, setLang] = useState<"en" | "fr" | "am">("en");

  // Define the initial data structure for a new declaration. This constant is
  // reused when cancelling or starting a new declaration to avoid missing fields.
  const INITIAL_DATA: any = {
    // Personal
    firstName: "",
    middleName: "",
    lastName: "",
    dob: "",
    sex: "",
    phone: "",
    nationality: "",
    passport: "",
    guardianName: "",
    guardianPhone: "",
    guardianAddress: "",
    // Travel
    purpose: "",
    airline: "",
    otherAirline: "",
    flightNumber: "",
    seatNumber: "",
    departureCountry: "",
    departureCity: "",
    arrivalDate: "",
    visitedList: [] as string[],
    // Clinical
    clinicalData: {} as Record<string, any>,
  };

  // Form data
  const [data, setData] = useState<any>({ ...INITIAL_DATA });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setData({ ...INITIAL_DATA });
    setStep(0);
    setErrors({});
  }

  // Declaration token and QR code after submission
  const [declarationToken, setDeclarationToken] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  // Edit lookup states
  const [editTokenInput, setEditTokenInput] = useState("");
  const [editPassportInput, setEditPassportInput] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editing, setEditing] = useState<{
    tei: string;
    enrollment: string;
    travelEvent?: string;
    clinicalEvent?: string;
  } | null>(null);

  // QR retrieval states
  const [qrLastName, setQrLastName] = useState("");
  const [qrPassport, setQrPassport] = useState("");
  const [qrDisplayUrl, setQrDisplayUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrClassification, setQrClassification] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Scroll to top whenever the current step or view changes to ensure the
  // user sees the beginning of the form. Without this, navigating between
  // steps may leave the scroll position midway through the page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step, view]);

  // Handler to cancel the current declaration process and return to landing.
  function cancelDeclaration() {
    // Clear any persisted form state
    try {
      localStorage.removeItem('formState');
      localStorage.removeItem('step');
    } catch (err) {}
    setEditing(null);
    setDeclarationToken(null);
    setQrUrl(null);
    setStep(0);
    setData({ ...INITIAL_DATA });
    setErrors({});
    setView('home');
  }

  // ===== Metadata fetch =====
  useEffect(() => {
    async function fetchMetadata() {
      try {
        // Fetch risk countries from option group
        const resp = await fetch(
          `${API_PREFIX}/optionGroups/m0EgeLz1Jzc?fields=name,options[name,code,sortOrder,translations]`,
          { headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` } }
        );
        if (resp.ok) {
          const json = await resp.json();
          const opts = json.options || [];
          const mapped = opts
            .map((o: any) => ({ label: o.name, value: o.code, sortOrder: o.sortOrder }))
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
            .map((o: any) => ({ label: o.label, value: o.value }));
          setCountriesOptions(mapped);
        }
        // Fetch clinical questions
        // Include valueType when fetching clinical metadata so we know how to render
        // Boolean questions (e.g. true/false) versus text inputs. valueType will
        // help us decide whether to render a yes/no radio group when no option
        // set is provided.
        const resp2 = await fetch(
          `${API_PREFIX}/programStages/${CLINICAL_STAGE_ID}?fields=name,programStageDataElements[dataElement[id,formName,valueType,translations,optionSet[options[name,code]]],sortOrder,compulsory]`,
          { headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` } }
        );
        if (resp2.ok) {
          const json2 = await resp2.json();
          const elems = json2.programStageDataElements || [];
          // Filter out the Health Status Flag data element (cGSuTAbYhkM) from being displayed
          const mapped2 = elems
            .filter((e: any) => e.dataElement.id !== 'cGSuTAbYhkM')
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
            .map((e: any) => ({
              id: e.dataElement.id,
              formName: e.dataElement.formName || e.dataElement.id,
              optionSet: e.dataElement.optionSet || null,
              valueType: e.dataElement.valueType || null,
              compulsory: e.compulsory,
            }));
          setClinicalElements(mapped2);
        }
      } catch (err) {
        console.error("Failed to fetch metadata", err);
      }
    }
    fetchMetadata();
  }, []);

  // Persist form data in local storage to avoid accidental page refresh data loss
  useEffect(() => {
    // Load from local storage on mount
    const saved = localStorage.getItem("travelerData");
    const savedStep = localStorage.getItem("travelerStep");
    const savedView = localStorage.getItem("travelerView");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setData((d: any) => ({ ...d, ...parsed }));
      } catch {}
    }
    if (savedStep) setStep(parseInt(savedStep));
    if (savedView) setView(savedView as View);
  }, []);
  useEffect(() => {
    // Save to local storage whenever data, step or view changes
    localStorage.setItem("travelerData", JSON.stringify(data));
    localStorage.setItem("travelerStep", String(step));
    localStorage.setItem("travelerView", view);
  }, [data, step, view]);
  useEffect(() => {
    // Warn on refresh if there is unsaved data
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (view === "form" || view === "summary") {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Reloading will discard your progress.";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [view]);

  function update(field: string, value: any) {
    setData((prev: any) => ({ ...prev, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  }
  function updateClinical(id: string, value: any) {
    setData((prev: any) => ({ ...prev, clinicalData: { ...prev.clinicalData, [id]: value } }));
    setErrors((e) => ({ ...e, [id]: "" }));
  }
  function toggleVisited(code: string) {
    setData((prev: any) => {
      const set = new Set(prev.visitedList);
      set.has(code) ? set.delete(code) : set.add(code);
      return { ...prev, visitedList: Array.from(set) };
    });
  }
  function validateCurrentStep(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!data.firstName) e.firstName = "First name is required.";
      else if (!/^[A-Za-z]+$/.test(data.firstName)) e.firstName = "Only letters are allowed.";
      if (!data.lastName) e.lastName = "Last name is required.";
      else if (!/^[A-Za-z]+$/.test(data.lastName)) e.lastName = "Only letters are allowed.";
      // Middle name is optional but must contain only letters if provided
      if (data.middleName && !/^[A-Za-z]+$/.test(data.middleName)) e.middleName = "Only letters are allowed.";
      if (!data.dob) e.dob = "Date of birth is required.";
      if (!data.sex) e.sex = "Select a value.";
      if (!data.phone) e.phone = "Phone number is required.";
      if (data.phone && !/^\+?[0-9]+$/.test(data.phone)) e.phone = "Use only + and digits.";
      if (!data.nationality) e.nationality = "Select nationality.";
      if (!data.passport) e.passport = "Passport number is required.";
      // Guardian for minors
      const age = (() => {
        if (!data.dob) return null;
        const d = new Date(data.dob);
        if (isNaN(d as any)) return null;
        const now = new Date();
        let y = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) y--;
        return y;
      })();
      if (age !== null && age < 18) {
        if (!data.guardianName) e.guardianName = "Guardian name required for minors.";
        if (!data.guardianPhone) e.guardianPhone = "Guardian phone required for minors.";
      }
    }
    if (step === 1) {
      if (!data.purpose) e.purpose = "Select purpose.";
      if (!data.airline) e.airline = "Select airline.";
      if (data.airline === "OTHER" && !data.otherAirline) e.otherAirline = "Specify airline.";
      if (!data.flightNumber) e.flightNumber = "Enter flight number.";
      if (!data.seatNumber) e.seatNumber = "Enter seat number.";
      if (!data.departureCountry) e.departureCountry = "Departure country required.";
      if (!data.arrivalDate) e.arrivalDate = "Arrival date required.";
      // Arrival date should be today or a future date
      else {
        const arrDate = new Date(data.arrivalDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (arrDate < today) {
          e.arrivalDate = "Arrival date cannot be in the past.";
        }
      }
    }
    if (step === 2) {
      // For clinical, check compulsory elements
      clinicalElements.forEach((el) => {
        if (el.compulsory && !data.clinicalData[el.id]) {
          e[el.id] = "Required";
        }
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ===== Submission =====
  async function handleSubmit() {
    setTriedSubmit(true);
    if (!agreeLegal) return;
    try {
      // Determine risk classification placeholder (GREEN by default)
      let classification = "GREEN";
      let teiUid: string | null = null;
      let enrollmentUid: string | null = null;
      let existingEnrollmentDate: string | undefined;
      let travelEventUid: string | null = null;
      let clinicalEventUid: string | null = null;
      let newTraveler = false;
      let needEnrollment = false;
      if (editing) {
        teiUid = editing.tei;
        enrollmentUid = editing.enrollment;
        travelEventUid = editing.travelEvent || null;
        clinicalEventUid = editing.clinicalEvent || null;
        if (!enrollmentUid) needEnrollment = true;
      } else {
        // Search for existing TEI by passport, phone or names
        const searchBase = `${API_PREFIX}/40/tracker/trackedEntities?fields=enrollments[enrollment],trackedEntity,orgUnit&program=${PROGRAM_ID}&page=1&ouMode=ACCESSIBLE`;
        let found: any = null;
        // By passport
        if (data.passport) {
          const resp1 = await fetch(`${searchBase}&filter=kDWurLVuVZw:eq:${encodeURIComponent(data.passport)}`, {
            headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` },
          });
          if (resp1.ok) {
            const json1 = await resp1.json();
            if (json1.instances && json1.instances.length > 0) found = json1.instances[0];
          }
        }
        // By phone
        if (!found && data.phone) {
          const resp2 = await fetch(`${searchBase}&filter=Vr0lFuBkaaV:eq:${encodeURIComponent(data.phone)}`, {
            headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` },
          });
          if (resp2.ok) {
            const json2 = await resp2.json();
            if (json2.instances && json2.instances.length > 0) found = json2.instances[0];
          }
        }
        // By names
        if (!found && data.firstName && data.lastName) {
          const resp3 = await fetch(`${searchBase}&filter=ur1JM6CZeSb:ilike:${encodeURIComponent(data.firstName)}&filter=vUacdogzWI6:ilike:${encodeURIComponent(data.lastName)}`, {
            headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` },
          });
          if (resp3.ok) {
            const json3 = await resp3.json();
            if (json3.instances && json3.instances.length > 0) found = json3.instances[0];
          }
        }
        if (found) {
          teiUid = found.trackedEntity;
          if (found.enrollments && found.enrollments.length > 0) {
            enrollmentUid = found.enrollments[0].enrollment;
            existingEnrollmentDate = found.enrollments[0].enrolledAt;
            console.log("Existing enrollment: " + existingEnrollmentDate);
          } else {
            needEnrollment = true;
          }
        } else {
          newTraveler = true;
        }
      }
      // Request IDs
      let uidCount = 0;
      if (editing) {
          if (!travelEventUid) uidCount++;
          if (!clinicalEventUid) uidCount++;
          if (!enrollmentUid) uidCount++;
      } else {
        if (newTraveler) uidCount = 4;
        else uidCount = needEnrollment ? 3 : 2;
      }
      let codes: string[] = [];
      if (uidCount > 0) {
        const idResp = await fetch(`${API_PREFIX}/system/id?limit=${uidCount}`, {
          headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` },
        });
        const idJson = idResp.ok ? await idResp.json() : { codes: [] };
        codes = idJson.codes || [];
      }
      let idx = 0;
      if (editing) {
        if (!enrollmentUid && codes[idx]) enrollmentUid = codes[idx++];
        if (!travelEventUid && codes[idx]) travelEventUid = codes[idx++];
        if (!clinicalEventUid && codes[idx]) clinicalEventUid = codes[idx++];
      } else {
        if (newTraveler) {
          teiUid = codes[idx++];
          enrollmentUid = codes[idx++];
          travelEventUid = codes[idx++];
          clinicalEventUid = codes[idx++];
        } else {
          if (needEnrollment) enrollmentUid = codes[idx++];
          travelEventUid = codes[idx++];
          clinicalEventUid = codes[idx++];
        }
      }
      const trackedEntity = teiUid!;
      const enrollment = enrollmentUid!;
      // Attributes mapping
      const attributes: { attribute: string; value: any }[] = [];
      const pushAttr = (attr: string, value: any) => {
        if (value !== undefined && value !== "") attributes.push({ attribute: attr, value });
      };
      pushAttr("ur1JM6CZeSb", data.firstName);
      pushAttr("wS7QQnuWCtc", data.middleName);
      pushAttr("vUacdogzWI6", data.lastName);
      pushAttr("Rv8WM2mTuS5", data.dob);
      pushAttr("S0laL1aHf6i", data.sex);
      pushAttr("Vr0lFuBkaaV", data.phone);
      pushAttr("GWQC1qQdw8Y", data.nationality);
      pushAttr("kDWurLVuVZw", data.passport);
      // Resident attribute using purpose (RESIDENT). This attribute has a true-only
      // value type in DHIS2. To avoid validation errors when the value is false,
      // we omit it entirely rather than sending "false". If needed, uncomment
      // the line below to send "true" when purpose === 'RESIDENT'.
      // pushAttr("WkRKe1sEBcJ", data.purpose === "RESIDENT" ? "true" : "false");
      // Travel event data
      const travelValues: { dataElement: string; value: any }[] = [];
      travelValues.push({ dataElement: "dP5GhQYdMMf", value: `${data.airline}${data.flightNumber}` });
      travelValues.push({ dataElement: "BXGTya98TLD", value: data.purpose });
      travelValues.push({ dataElement: "EvJTARXbuPj", value: data.airline });
      if (data.airline === "OTHER" && data.otherAirline) travelValues.push({ dataElement: "ozBn9o48C7F", value: data.otherAirline });
      travelValues.push({ dataElement: "R775EQee9sB", value: data.flightNumber });
      travelValues.push({ dataElement: "Q20Pk08bg5U", value: data.seatNumber });
      travelValues.push({ dataElement: "BoQdGhFv7te", value: data.departureCountry });
      travelValues.push({ dataElement: "ebDNzAopp9K", value: data.departureCity });
      // Place of Stay is no longer collected; do not include dataElement FoXx0EfvELo
      const visitedKeys = ["AXpyzUwlcxY", "g4la792LVkV", "k9KUAc7EUvk", "f5H0rOaVBzu", "aUfY6AbcnH0"];
      // Map each selected country code to its corresponding country name. Since the
      // DHIS2 instance doesn't support a multi-select for visited countries, we
      // assign up to five data elements in order. Unused elements are omitted.
      for (let i = 0; i < visitedKeys.length; i++) {
        const code = data.visitedList[i];
        if (code) {
          // Send the ISO code to DHIS2. The summary view will still display the name.
          travelValues.push({ dataElement: visitedKeys[i], value: code });
        }
      }
      const occurredAt = data.arrivalDate || new Date().toISOString().slice(0, 10);
      const travelEvent = {
        status: "COMPLETED",
        completedAt: occurredAt,
        occurredAt: occurredAt,
        programStage: TRAVEL_STAGE_ID,
        program: PROGRAM_ID,
        orgUnit: ORG_UNIT_ID,
        event: travelEventUid!,
        dataValues: travelValues,
      };
      // Clinical event data values
      const clinicalValues: { dataElement: string; value: any }[] = [];
      clinicalElements.forEach((el) => {
        const val = data.clinicalData[el.id];
        if (val !== undefined && val !== "") clinicalValues.push({ dataElement: el.id, value: val });
      });
      // Include classification value -> Not needed because it is determined with Program Rules on server side
      //clinicalValues.push({ dataElement: "cGSuTAbYhkM", value: "null" });
      const clinicalEvent = {
        status: "COMPLETED",
        completedAt: occurredAt,
        occurredAt: occurredAt,
        programStage: CLINICAL_STAGE_ID,
        program: PROGRAM_ID,
        orgUnit: ORG_UNIT_ID,
        event: clinicalEventUid!,
        dataValues: clinicalValues,
      };
      const enrollmentDate = existingEnrollmentDate
        ? existingEnrollmentDate   // editing existing TEI → reuse what server gave us
        : new Date().toISOString().split("T")[0]; // today      
      const enrollmentObj = {
        program: PROGRAM_ID,
        status: "ACTIVE",
        orgUnit: ORG_UNIT_ID,
        enrolledAt: enrollmentDate,
        enrollment: enrollment,
        events: [travelEvent, clinicalEvent],
      };
      const teiObj = {
        trackedEntity: trackedEntity,
        orgUnit: ORG_UNIT_ID,
        trackedEntityType: TRACKED_ENTITY_TYPE_ID,
        attributes: attributes,
        enrollments: [enrollmentObj],
      };
      const payload = { trackedEntities: [teiObj] };
      // Clear Health Status Flag

      // Post
      const postResp = await fetch(`${API_PREFIX}/tracker?async=false`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiToken ${DHIS2_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });
      if (!postResp.ok) {
        const errText = await postResp.text();
        throw new Error(`DHIS2 responded with ${postResp.status}: ${errText}`);
      }
      else {
        // Get the Health Status Flag
        const fetchResp = await fetch(
        `${API_PREFIX}/tracker/enrollments/${enrollmentUid}?fields=trackedEntity,program,enrolledAt,events[dataValues[dataElement,value]]`,
          { headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` } }
        );
        const enrollmentData = await fetchResp.json();

        // find the Health Status Flag in the clinical event’s dataValues -> classification
        for (const ev of enrollmentData.events || []) {
          for (const dv of ev.dataValues || []) {
            if (dv.dataElement === "cGSuTAbYhkM") {
              classification = dv.value;
            }
          }
        }
      }
      // Token and QR
      const token = `${trackedEntity}-${enrollment}-${clinicalEventUid}`;
      setDeclarationToken(token);
      // Include middle name and passport in the QR payload if provided. This
      // allows border officials to quickly match the QR to the traveler's
      // identification. Only include middleName when present.
      const qrData: any = {
        token,
        classification,
        firstName: data.firstName,
        lastName: data.lastName,
        passport: data.passport,
      };
      if (data.middleName) qrData.middleName = data.middleName;
      const qrPayload = JSON.stringify(qrData);
      const qrService = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=";
      setQrUrl(qrService + encodeURIComponent(qrPayload));
      // Clear local storage and editing state
      localStorage.removeItem("travelerData");
      setEditing(null);
      setView("complete");
      setStep(4);
    } catch (err: any) {
      console.error(err);
      alert(`Submission failed: ${err.message || err}`);
    }
  }

  // ===== Edit lookup =====
  async function handleEditLookup() {
    setEditError(null);
    if (!editTokenInput && !editPassportInput) {
      setEditError("Please enter a declaration ID or passport number.");
      return;
    }
    setEditLoading(true);
    try {
      let tei: string | null = null;
      let enrollment: string | null = null;
      let travelEvent: string | undefined;
      let clinicalEvent: string | undefined;
      if (editTokenInput) {
        const parts = editTokenInput.trim().split("-");
        if (parts.length >= 3) {
          tei = parts[0];
          enrollment = parts[1];
          clinicalEvent = parts[2];
        } else {
          throw new Error("Invalid declaration ID format.");
        }
      } else if (editPassportInput) {
        const searchBase = `${API_PREFIX}/40/tracker/trackedEntities?fields=enrollments[enrollment],trackedEntity,orgUnit&program=${PROGRAM_ID}&page=1&ouMode=ACCESSIBLE`;
        let found: any = null;
        const resp = await fetch(`${searchBase}&filter=kDWurLVuVZw:eq:${encodeURIComponent(editPassportInput.trim())}`, { headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` } });
        if (resp.ok) {
          const json = await resp.json();
          if (json.instances && json.instances.length > 0) {
            found = json.instances[0];
          }
        }
        if (!found) {
          throw new Error("Declaration not found for the given passport number.");
        }
        tei = found.trackedEntity;
        if (found.enrollments && found.enrollments.length > 0) enrollment = found.enrollments[0].enrollment;
      }
      if (!tei) throw new Error("Unable to determine tracked entity.");
      // Fetch the full tracked entity details. Use API_PREFIX so requests go
      // through the Vite dev proxy in development. The path `/40/tracker/trackedEntities/...`
      // will be rewritten to the DHIS2 server by the proxy. In production,
      // API_PREFIX already resolves to the full DHIS2 URL with `/api`.
      const resp = await fetch(
        `${API_PREFIX}/40/tracker/trackedEntities/${tei}?program=${PROGRAM_ID}&fields=enrollments[enrollment,events[event,programStage,dataValues[dataElement,value],occurredAt,completedAt]],attributes[attribute,value]`,
        { headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` } }
      );
      if (!resp.ok) throw new Error(`Failed to fetch traveler details: ${resp.status}`);
      const full = await resp.json();
      if (!full.enrollments || full.enrollments.length === 0) throw new Error("No enrollment found for this traveler.");
      const enrollmentObj = enrollment ? full.enrollments.find((e: any) => e.enrollment === enrollment) || full.enrollments[0] : full.enrollments[0];
      enrollment = enrollmentObj.enrollment;
      const attrMap: Record<string, string> = {};
      if (full.attributes) full.attributes.forEach((att: any) => { attrMap[att.attribute] = att.value; });
      const newData: any = { ...data };
      newData.firstName = attrMap["ur1JM6CZeSb"] || "";
      newData.middleName = attrMap["wS7QQnuWCtc"] || "";
      newData.lastName = attrMap["vUacdogzWI6"] || "";
      newData.dob = attrMap["Rv8WM2mTuS5"] || "";
      newData.sex = attrMap["S0laL1aHf6i"] || "";
      newData.phone = attrMap["Vr0lFuBkaaV"] || "";
      newData.nationality = attrMap["GWQC1qQdw8Y"] || "";
      newData.passport = attrMap["kDWurLVuVZw"] || "";
      // Reset travel and clinical
      newData.purpose = "";
      newData.airline = "";
      newData.otherAirline = "";
      newData.flightNumber = "";
      newData.seatNumber = "";
      newData.departureCountry = "";
      newData.departureCity = "";
      newData.arrivalDate = "";
      // Place of Stay removed; no reset needed
      newData.visitedList = [];
      newData.clinicalData = {};
      let travelFound: any = null;
      let clinicalFound: any = null;
      if (enrollmentObj.events && enrollmentObj.events.length > 0) {
        enrollmentObj.events.forEach((ev: any) => {
          if (ev.programStage === TRAVEL_STAGE_ID) travelFound = ev;
          if (ev.programStage === CLINICAL_STAGE_ID) clinicalFound = ev;
        });
      }
      if (travelFound) {
        travelEvent = travelFound.event;
        if (travelFound.occurredAt) {
          const s = String(travelFound.occurredAt);
          newData.arrivalDate = s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
        }
        travelFound.dataValues.forEach((dv: any) => {
          const de = dv.dataElement;
          const val = dv.value;
          switch (de) {
            case "dP5GhQYdMMf": {
              if (typeof val === "string" && val.length >= 2) {
                const code = val.slice(0, 2);
                const num = val.slice(2);
                const airlineDef = AIRLINES.find((a) => a.value === code);
                if (airlineDef) {
                  newData.airline = airlineDef.value;
                  newData.flightNumber = num;
                } else {
                  newData.airline = "OTHER";
                  newData.otherAirline = code;
                  newData.flightNumber = num;
                }
              }
              break;
            }
            case "BXGTya98TLD": newData.purpose = val; break;
            case "EvJTARXbuPj": if (!newData.airline) newData.airline = val; break;
            case "ozBn9o48C7F": newData.otherAirline = val; break;
            case "R775EQee9sB": newData.flightNumber = val; break;
            case "Q20Pk08bg5U": newData.seatNumber = val; break;
            case "BoQdGhFv7te": newData.departureCountry = val; break;
            case "ebDNzAopp9K": newData.departureCity = val; break;
            // case "FoXx0EfvELo": // Place of Stay removed
            //   break;
            case "AXpyzUwlcxY": case "g4la792LVkV": case "k9KUAc7EUvk": case "f5H0rOaVBzu": case "aUfY6AbcnH0": {
              // Convert stored country name back to ISO code for the UI. The DHIS2
              // payload stores the name of the visited country. To mark the
              // corresponding checkbox, we need the code. Try to find a match
              // in the dynamic metadata list or fall back to the static list.
              let code = countriesOptions.find((c) => c.label === val)?.value;
              if (!code) {
                const match = COUNTRY_LIST.find((c) => c.label === val);
                code = match ? match.value : val;
              }
              newData.visitedList.push(code);
              break;
            }
          }
        });
      }
      if (clinicalFound) {
        clinicalEvent = clinicalFound.event;
        clinicalFound.dataValues.forEach((dv: any) => {
          const de = dv.dataElement;
          const val = dv.value;
          // Skip classification element; everything else goes into clinicalData
          if (de !== "cGSuTAbYhkM") {
            newData.clinicalData[de] = val;
          }
        });
      }
      setData(newData);
      setEditing({ tei: tei, enrollment: enrollment!, travelEvent, clinicalEvent });
      setView("form");
      setStep(0);
      // Reset search values
      setEditTokenInput("");
      setEditPassportInput("");
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || "An error occurred during lookup.");
    } finally {
      setEditLoading(false);
    }
  }

  // ===== QR retrieval =====
  async function handleQrLookup() {
    setQrError(null);
    if (!qrLastName.trim() || !qrPassport.trim()) {
      setQrError("Please enter Last name and Passport number.");
      return;
    }
    setQrLoading(true);
    try {
      let tei: string | null = null;
      let enrollment: string | null = null;
      const ln = encodeURIComponent(qrLastName.trim());
      const pp = encodeURIComponent(qrPassport.trim());
      const searchBase = `${API_PREFIX}/40/tracker/trackedEntities?fields=enrollments[enrollment],trackedEntity,orgUnit,attributes[attribute,value]&program=${PROGRAM_ID}&page=1&ouMode=ACCESSIBLE`;
      let found: any = null;
      const resp = await fetch(`${searchBase}&filter=vUacdogzWI6:ilike:${ln}&filter=kDWurLVuVZw:ilike:${pp}`, { headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` } });
      if (resp.ok) {
        const json = await resp.json();
        if (json.instances && json.instances.length > 0) found = json.instances[0];
      }
      if (!found) throw new Error("No matching traveler found.");
      tei = found.trackedEntity;
      if (found.enrollments && found.enrollments.length > 0) enrollment = found.enrollments[0].enrollment;
      if (!tei || !enrollment) throw new Error("Traveler has no active enrollment.");
      // Fetch full details for the tracked entity via API_PREFIX. Using the proxy
      // avoids CORS issues during development. In production builds the prefix
      // resolves to the real DHIS2 API URL.
      const detailResp = await fetch(
        `${API_PREFIX}/40/tracker/trackedEntities/${tei}?program=${PROGRAM_ID}&fields=enrollments[enrollment,events[event,programStage,occurredAt,completedAt,dataValues[dataElement,value]]],attributes[attribute,value]`,
        { headers: { Authorization: `ApiToken ${DHIS2_TOKEN}` } }
      );
      if (!detailResp.ok) throw new Error(`Failed to fetch traveler details: ${detailResp.status}`);
      const full = await detailResp.json();
      const attrMap: Record<string, string> = {};
      if (full.attributes) full.attributes.forEach((att: any) => { attrMap[att.attribute] = att.value; });
      const firstName = attrMap["ur1JM6CZeSb"] || "";
      const middleName = attrMap["wS7QQnuWCtc"] || "";
      const lastName = attrMap["vUacdogzWI6"] || "";
      const passportVal = attrMap["kDWurLVuVZw"] || "";
      const enrollmentObj = full.enrollments?.find((e: any) => e.enrollment === enrollment) || full.enrollments?.[0];
      if (!enrollmentObj) throw new Error("No enrollment found for traveler.");
      const clinicalEvents = (enrollmentObj.events || []).filter((ev: any) => ev.programStage === CLINICAL_STAGE_ID);
      if (!clinicalEvents || clinicalEvents.length === 0) throw new Error("No clinical data found for traveler.");
      clinicalEvents.sort((a: any, b: any) => {
        const dateA = new Date(a.occurredAt || a.completedAt || 0).getTime();
        const dateB = new Date(b.occurredAt || b.completedAt || 0).getTime();
        return dateB - dateA;
      });
      const latestClinical = clinicalEvents[0];
      let classification = "GREEN";
      if (latestClinical.dataValues) {
        latestClinical.dataValues.forEach((dv: any) => {
          if (dv.dataElement === "cGSuTAbYhkM") classification = dv.value || classification;
        });
      }
      const token = `${tei}-${enrollment}-${latestClinical.event}`;
      const qrData: any = { token, classification, firstName, lastName, passport: passportVal };
      if (middleName) qrData.middleName = middleName;
      const qrPayload = JSON.stringify(qrData);
      const qrService = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=";
      const qrImageUrl = qrService + encodeURIComponent(qrPayload);
      setQrToken(token);
      setQrClassification(classification);
      setQrDisplayUrl(qrImageUrl);
      // Reset search values
      setQrPassport("");
      setQrLastName("");
    } catch (err: any) {
      console.error(err);
      setQrError(err.message || "Failed to retrieve QR code.");
      setQrDisplayUrl(null);
      setQrToken(null);
      setQrClassification(null);
    } finally {
      setQrLoading(false);
    }
  }

  // ===== Rendering by view =====
  if (view === "home") {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar lang={lang} setLang={setLang} />
        <main className="max-w-6xl mx-auto px-4 pt-8 pb-16 space-y-8">
          <div className="flex flex-col gap-3 text-gray-700 bg-white rounded-2xl px-4 py-3 w-full md:w-fit shadow-sm">
            <div className="flex items-center gap-3">
              <span>{STRINGS[lang].readmoreintro}</span>
              <button
                type="button"
                onClick={() => setShowReadMore(!showReadMore)}
                className="text-red-600 font-semibold underline-offset-2 hover:underline"
              >
                Read more →
              </button>
            </div>
            {showReadMore && (
              <p className="text-sm leading-6 text-gray-700 max-w-3xl">
                {STRINGS[lang].readmore}
              </p>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">New Declaration</h2>
                <p className="text-gray-600">Start a new pre-travel registration. It takes a few minutes.</p>
                <button
                  onClick={() => {
                    resetForm();
                    setView("form");
                    setStep(0);
                  }}
                  className="px-6 py-3 rounded-2xl text-white bg-emerald-700 hover:bg-emerald-800 text-lg font-semibold w-full"
                >
                  + New Declaration
                </button>
              </div>
            </Card>
            <Card>
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Edit Declaration</h2>
                <p className="text-gray-600">Find an existing submission by Declaration ID or Passport Number.</p>
                <button
                  onClick={() => setView("edit")}
                  className="px-6 py-3 rounded-2xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-lg font-semibold w-full"
                >
                  ✎ Edit Declaration
                </button>
              </div>
            </Card>
            <Card>
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Get my QR Code</h2>
                <p className="text-gray-600">
                  You can retrieve here the QR code that was generated during your declaration submission.
                </p>
                <button
                  onClick={() => setView("qr")}
                  className="px-6 py-3 rounded-2xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-lg font-semibold w-full"
                >
                  Get my QR Code ↗
                </button>
              </div>
            </Card>
          </div>
        </main>
        {/* Footer appears only on the home page */}
        <Footer />
      </div>
    );
  }
  if (view === "form") {
    // Show step forms
    if (step === 0) return <PersonalForm data={data} errors={errors} update={update} next={() => { if (validateCurrentStep()) setStep(1); }} cancel={cancelDeclaration} />;
    if (step === 1) return <TravelForm data={data} errors={errors} update={update} toggleVisited={toggleVisited} back={() => setStep(0)} next={() => { if (validateCurrentStep()) setStep(2); }} cancel={cancelDeclaration} countriesOptions={countriesOptions} />;
    if (step === 2) return <ClinicalForm data={data} updateClinical={updateClinical} back={() => setStep(1)} next={() => { if (validateCurrentStep()) setStep(3); }} cancel={cancelDeclaration} clinicalElements={clinicalElements} errors={errors} />;
    if (step === 3) return <SummaryView data={data} countriesOptions={countriesOptions} clinicalElements={clinicalElements} onBack={() => setStep(2)} onSubmit={handleSubmit} cancel={cancelDeclaration} agreeLegal={agreeLegal} triedSubmit={triedSubmit} setAgreeLegal={setAgreeLegal}/>;
  }
  if (view === "edit") {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar lang={lang} setLang={setLang} />
        <main className="max-w-5xl mx-auto p-4">
          <Card>
            <div className="grid md:grid-cols-2 gap-6">
              <Field label="Declaration ID (token)">
                <input
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                  placeholder="e.g. q6NIbZqdW0t-rDH4lmtvNiS-s0VmSoesN06"
                  value={editTokenInput}
                  onChange={(e) => setEditTokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEditLookup(); // same function used by the Look Up button
                    }
                  }}
                />
              </Field>
              <Field label="Passport Number">
                <input
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                  placeholder="e.g., AB1234567"
                  value={editPassportInput}
                  onChange={(e) => setEditPassportInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEditLookup(); // same function used by the Look Up button
                    }
                  }}
                />
              </Field>
            </div>
            {editError && <p className="text-rose-600 mt-4">{editError}</p>}
            <div className="mt-6 flex justify-end">
              <button
                disabled={editLoading}
                onClick={handleEditLookup}
                className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-lg font-semibold disabled:opacity-50"
              >
                {editLoading ? "Searching..." : "Lookup"}
              </button>
            </div>
          </Card>
          <div className="mt-6">
        <button onClick={() => setView("home")} className="text-gray-600 hover:underline">← Back to home</button>
          </div>
        </main>
      </div>
    );
  }
  if (view === "qr") {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar lang={lang} setLang={setLang} />
        <main className="max-w-5xl mx-auto p-4">
          <Card>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Retrieve My QR Code</h2>
            <p className="text-gray-600 mb-4">
              To retrieve your QR code, enter your Last Name and Passport Number
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <Field label="Last Name">
                <input
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                  value={qrLastName}
                  onChange={(e) => setQrLastName(e.target.value)}
                  placeholder="Last Name"
                  onKeyDown={(e) => { if (e.key === "Enter") handleQrLookup(); }}
                />
              </Field>
              <Field label="Passport Number">
                <input
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg"
                  value={qrPassport}
                  onChange={(e) => setQrPassport(e.target.value)}
                  placeholder="Passport Number"
                  onKeyDown={(e) => { if (e.key === "Enter") handleQrLookup(); }}
                />
              </Field>
            </div>
            {qrError && <p className="text-rose-600 mt-4">{qrError}</p>}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleQrLookup}
                disabled={qrLoading}
                className="px-6 py-3 rounded-2xl bg-emerald-700 text-white text-lg font-semibold disabled:opacity-50"
              >
                {qrLoading ? "Fetching..." : "Generate QR Code"}
              </button>
            </div>
            {qrDisplayUrl && qrToken && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Your QR Code</h3>
                <div className="flex flex-col items-center gap-3">
                  <img src={qrDisplayUrl} alt="Generated QR code" className="w-40 h-40 border" />
                  <div className="bg-gray-50 rounded-xl p-4 border text-center w-full md:w-auto">
                    <p className="text-sm text-gray-600 mb-1">Declaration ID</p>
                    <p className="font-mono text-lg break-all">{qrToken}</p>
                  </div>
                  {qrClassification && (
                    <p className="text-lg font-semibold mt-2">
                      Risk Classification: <span className={qrClassification === "RED" ? "text-red-600" : qrClassification === "ORANGE" ? "text-orange-500" : "text-emerald-600"}>{qrClassification}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>
          <div className="mt-6">
            <button onClick={() => setView("home")} className="text-gray-600 hover:underline">← Back to home</button>
          </div>
        </main>
      </div>
    );
  }
  if (view === "complete") {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar lang={lang} setLang={setLang} />
        <main className="max-w-4xl mx-auto p-4">
          <Card>
            <h2 className="text-2xl font-bold mb-4 text-emerald-700">Submission Complete</h2>
            <p className="mb-4 text-gray-700">
              Thank you for submitting your declaration. A QR code has been generated below.
              Please keep your declaration ID handy for future reference or to edit your submission.
            </p>
            {qrUrl && (
              <div className="flex justify-center mb-4">
                <img src={qrUrl} alt="Declaration QR code" className="w-40 h-40 border" />
              </div>
            )}
            {declarationToken && (
              <div className="bg-gray-50 rounded-xl p-4 border text-center">
                <p className="text-sm text-gray-600 mb-1">Declaration ID</p>
                <p className="font-mono text-lg break-all">{declarationToken}</p>
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => {
                  setView("form");
                  setStep(0);
                  setDeclarationToken(null);
                  setQrUrl(null);
                  setData({
                    firstName: "",
                    middleName: "",
                    lastName: "",
                    dob: "",
                    sex: "",
                    phone: "",
                    nationality: "",
                    passport: "",
                    guardianName: "",
                    guardianPhone: "",
                    guardianAddress: "",
                    purpose: "",
                    airline: "",
                    otherAirline: "",
                    flightNumber: "",
                    seatNumber: "",
                    departureCountry: "",
                    departureCity: "",
                    arrivalDate: "",
                    // Place of Stay removed
                    visitedList: [],
                    clinicalData: {},
                  });
                  resetForm();
                }}
                className="px-6 py-3 rounded-2xl bg-white border border-gray-300 text-gray-800 text-lg font-semibold"
              >
                New Declaration
              </button>
              <button onClick={() => setView("home")} className="px-6 py-3 rounded-2xl bg-emerald-700 text-white text-lg font-semibold">
                Back to home page
              </button>
            </div>
          </Card>
        </main>
      </div>
    );
  }
  // Fallback
  return null;
}