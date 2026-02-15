import {
  NOTE_NAMES, MODES, SHARP_ORDER, FLAT_ORDER,
  toMidi, intervalInfo, getNoteAccidental, getKeySigWidth,
} from './music.js';

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const STAFF_LINE_GAP = 11, NOTE_RY = 5.5, BAR_WIDTH = 56, LEFT_MARGIN = 16, CLEF_WIDTH = 32, STAFF_TOP = 60;

// Clef definitions: reference note sitting on the middle staff line
// treble: B4, alto: C4, bass: D3
export const CLEFS = {
  treble: { ref: "B", refOct: 4 },
  alto:   { ref: "C", refOct: 4 },
  bass:   { ref: "D", refOct: 3 },
};

// SVG path data for clefs (from Wikimedia Commons Clefs.svg, public domain)
// Each path is paired with a pre-computed matrix transform that maps original
// coordinates to our staff layout (STAFF_TOP=60, STAFF_LINE_GAP=11).
const CLEF_PATHS = {
  treble: {
    d: "M 2002,7851 C 1941,7868 1886,7906 1835,7964 C 1784,8023 1759,8088 1759,8158 C 1759,8202 1774,8252 1803,8305 C 1832,8359 1876,8398 1933,8423 C 1952,8427 1961,8437 1961,8451 C 1961,8456 1954,8461 1937,8465 C 1846,8442 1771,8393 1713,8320 C 1655,8246 1625,8162 1623,8066 C 1626,7963 1657,7867 1716,7779 C 1776,7690 1853,7627 1947,7590 L 1878,7235 C 1724,7363 1599,7496 1502,7636 C 1405,7775 1355,7926 1351,8089 C 1353,8162 1368,8233 1396,8301 C 1424,8370 1466,8432 1522,8489 C 1635,8602 1782,8661 1961,8667 C 2022,8663 2087,8652 2157,8634 L 2002,7851 z M 2074,7841 L 2230,8610 C 2384,8548 2461,8413 2461,8207 C 2452,8138 2432,8076 2398,8021 C 2365,7965 2321,7921 2265,7889 C 2209,7857 2146,7841 2074,7841 z M 1869,6801 C 1902,6781 1940,6746 1981,6697 C 2022,6649 2062,6592 2100,6528 C 2139,6463 2170,6397 2193,6330 C 2216,6264 2227,6201 2227,6143 C 2227,6118 2225,6093 2220,6071 C 2216,6035 2205,6007 2186,5988 C 2167,5970 2143,5960 2113,5960 C 2053,5960 1999,5997 1951,6071 C 1914,6135 1883,6211 1861,6297 C 1838,6384 1825,6470 1823,6557 C 1828,6656 1844,6737 1869,6801 z M 1806,6859 C 1761,6697 1736,6532 1731,6364 C 1732,6256 1743,6155 1764,6061 C 1784,5967 1813,5886 1851,5816 C 1888,5746 1931,5693 1979,5657 C 2022,5625 2053,5608 2070,5608 C 2083,5608 2094,5613 2104,5622 C 2114,5631 2127,5646 2143,5666 C 2262,5835 2322,6039 2322,6277 C 2322,6390 2307,6500 2277,6610 C 2248,6719 2205,6823 2148,6920 C 2090,7018 2022,7103 1943,7176 L 2024,7570 C 2068,7565 2098,7561 2115,7561 C 2191,7561 2259,7577 2322,7609 C 2385,7641 2439,7684 2483,7739 C 2527,7793 2561,7855 2585,7925 C 2608,7995 2621,8068 2621,8144 C 2621,8262 2590,8370 2528,8467 C 2466,8564 2373,8635 2248,8681 C 2256,8730 2270,8801 2291,8892 C 2311,8984 2326,9057 2336,9111 C 2346,9165 2350,9217 2350,9268 C 2350,9347 2331,9417 2293,9479 C 2254,9541 2202,9589 2136,9623 C 2071,9657 1999,9674 1921,9674 C 1811,9674 1715,9643 1633,9582 C 1551,9520 1507,9437 1503,9331 C 1506,9284 1517,9240 1537,9198 C 1557,9156 1584,9122 1619,9096 C 1653,9069 1694,9055 1741,9052 C 1780,9052 1817,9063 1852,9084 C 1886,9106 1914,9135 1935,9172 C 1955,9209 1966,9250 1966,9294 C 1966,9353 1946,9403 1906,9444 C 1866,9485 1815,9506 1754,9506 L 1731,9506 C 1770,9566 1834,9597 1923,9597 C 1968,9597 2014,9587 2060,9569 C 2107,9550 2146,9525 2179,9493 C 2212,9461 2234,9427 2243,9391 C 2260,9350 2268,9293 2268,9222 C 2268,9174 2263,9126 2254,9078 C 2245,9031 2231,8968 2212,8890 C 2193,8813 2179,8753 2171,8712 C 2111,8727 2049,8735 1984,8735 C 1875,8735 1772,8713 1675,8668 C 1578,8623 1493,8561 1419,8481 C 1346,8401 1289,8311 1248,8209 C 1208,8108 1187,8002 1186,7892 C 1190,7790 1209,7692 1245,7600 C 1281,7507 1327,7419 1384,7337 C 1441,7255 1500,7180 1561,7113 C 1623,7047 1704,6962 1806,6859 z",
    transform: "matrix(0.01831,0,0,0.01865,-5.71348,-58.95802)",
  },
  alto: {
    d: "M -238.81562,470.75666 L -238.81562,48.721998 L -238.81562,39.388187 L -189.96554,39.388187 L -189.96554,461.42285 L -189.96554,470.75666 L -238.81562,470.75666 z M -165.35686,470.75666 L -165.35686,48.721998 L -165.35686,39.388187 L -149.74687,39.388187 L -149.74687,250.77155 C -142.0337,246.7452 -134.13688,238.50949 -126.42371,225.51536 C -118.5269,212.70424 -111.91561,199.16107 -106.7735,184.70281 C -101.63138,170.24456 -98.876679,159.62963 -98.509386,152.67503 C -96.121976,168.04837 -92.265391,180.31043 -87.123278,189.64424 C -81.797518,198.79504 -76.104464,205.38361 -69.493175,209.40996 C -62.881887,213.25329 -56.454246,215.26647 -49.842957,215.26647 C -33.498383,215.26647 -23.214157,207.94583 -18.806631,193.12154 C -14.399105,178.29726 -12.195343,160.17868 -12.195343,138.76582 C -12.195343,129.06598 -12.37899,120.28122 -12.92993,112.59455 C -13.480871,104.90788 -14.582752,97.038196 -16.602868,89.168512 C -18.439337,81.298829 -21.561335,74.161208 -25.96886,67.938668 C -30.560033,61.716127 -36.436733,57.323746 -43.782609,55.127555 C -50.393898,53.297396 -57.005186,52.382316 -63.432828,52.382316 C -69.309529,52.382316 -74.267995,53.480412 -78.12458,55.493587 C -82.164812,57.506762 -84.368574,60.618032 -84.735868,64.27835 C -83.817634,67.572636 -81.613871,71.41597 -77.757286,75.991367 C -73.900701,80.383749 -71.329644,83.861051 -69.860469,86.057242 C -68.391294,88.253433 -67.656706,91.364703 -67.656706,95.574069 C -67.656706,103.07772 -70.227763,109.30026 -75.369876,114.42471 C -80.511989,119.54915 -87.306925,122.29439 -95.938329,122.29439 C -104.38609,122.29439 -111.36467,119.18312 -116.50678,113.1436 C -121.6489,106.92105 -124.4036,99.600419 -124.77089,91.364703 C -124.0363,80.200733 -119.99607,70.50089 -112.83384,62.448191 C -105.48797,54.578507 -96.48927,48.538982 -85.654103,44.512633 C -74.818936,40.486283 -63.983768,38.473108 -52.964954,38.473108 C -40.476965,38.473108 -28.539917,40.669299 -17.153809,45.06168 C -5.5840543,49.454062 4.7001721,56.042634 13.515223,64.461366 C 22.513921,73.063113 29.676151,83.495019 34.818264,95.940101 C 39.960377,108.20217 42.531434,122.29439 42.531434,137.85074 C 42.531434,159.44662 38.491202,177.38218 30.594385,191.4744 C 22.513921,205.74964 12.229695,216.36456 -0.25829416,222.95314 C -12.92993,229.54171 -26.336154,233.20203 -40.476965,233.56806 C -55.168717,232.65298 -67.47306,229.35869 -77.206345,223.6852 L -96.672917,255.16393 L -77.206345,286.45965 C -63.800122,280.96918 -50.577545,278.22394 -37.722262,278.22394 C -21.377688,278.22394 -7.2368764,282.98235 5.0674659,292.13315 C 17.188161,301.46696 26.554153,313.36299 32.981795,328.18728 C 39.225789,343.01157 42.531434,358.20189 42.531434,373.94125 C 42.531434,391.14475 38.674849,407.25015 30.961679,422.07443 C 23.248509,436.89872 12.413342,448.61174 -1.5438225,457.57952 C -15.684634,466.36428 -31.661914,470.75666 -49.842957,470.75666 C -70.962351,469.84158 -88.592453,464.90015 -102.73326,455.74936 C -116.87408,446.78158 -123.85266,433.2384 -123.85266,415.48586 C -123.11807,406.88411 -119.99607,400.29554 -114.48667,395.35411 C -108.97726,390.22967 -103.10056,387.66745 -96.672917,387.1184 C -88.959747,387.1184 -81.981165,389.86364 -75.920817,395.35411 C -69.860469,400.66157 -66.738472,407.43316 -66.738472,415.48586 C -66.738472,418.59713 -67.47306,421.52539 -68.942235,424.27063 C -70.41141,426.83285 -72.431526,429.94412 -75.369876,433.60444 C -78.308227,437.08174 -80.328343,439.64396 -81.430224,441.2911 C -82.532105,443.12126 -83.45034,445.13444 -83.817634,447.69666 C -83.817634,450.99095 -81.797518,453.73619 -77.573639,455.93238 C -73.533407,458.12857 -68.207647,459.40968 -61.780006,459.95873 C -41.578847,459.04365 -28.172623,450.4419 -21.377688,434.51952 C -14.766399,418.2311 -11.460755,398.28237 -11.460755,373.94125 C -11.460755,352.89442 -13.848165,334.40982 -18.622984,318.67045 C -23.397804,302.74807 -33.68203,294.87838 -49.842957,294.87838 C -64.167415,294.87838 -75.186229,300.91791 -82.899399,313.36299 C -90.612569,325.62506 -95.571035,340.08331 -97.774798,356.73776 C -100.16221,342.64553 -103.83515,329.10236 -109.16091,316.10823 C -114.48667,302.93108 -120.54701,291.40108 -127.70924,281.51822 C -134.50418,271.81838 -142.0337,263.9487 -149.74687,258.45822 L -149.74687,470.75666 L -165.35686,470.75666 z",
    transform: "matrix(0.10195,0,0,0.10195,40.36605,56.10143)",
  },
  bass: {
    d: "M 1239,8245 C 1397,8138 1515,8057 1591,8001 C 1667,7946 1747,7877 1829,7795 C 1911,7713 1980,7620 2036,7517 C 2080,7441 2118,7353 2149,7253 C 2180,7154 2196,7058 2199,6967 C 2199,6882 2188,6801 2165,6725 C 2143,6648 2105,6585 2051,6534 C 1997,6484 1927,6459 1840,6459 C 1756,6459 1677,6476 1603,6509 C 1530,6543 1478,6597 1449,6673 C 1449,6680 1445,6689 1439,6702 C 1441,6718 1449,6730 1464,6739 C 1479,6748 1492,6752 1504,6752 C 1510,6752 1527,6749 1553,6743 C 1580,6737 1602,6733 1620,6733 C 1673,6733 1720,6752 1763,6789 C 1805,6826 1826,6871 1826,6924 C 1826,6962 1815,6998 1794,7031 C 1773,7064 1744,7091 1707,7110 C 1670,7130 1629,7139 1585,7139 C 1505,7139 1437,7115 1381,7066 C 1326,7016 1298,6953 1298,6874 C 1298,6773 1329,6686 1390,6612 C 1452,6538 1530,6483 1626,6446 C 1721,6408 1817,6390 1915,6390 C 2022,6390 2124,6417 2219,6472 C 2315,6526 2390,6601 2446,6694 C 2502,6788 2531,6888 2531,6996 C 2531,7188 2467,7366 2339,7531 C 2211,7696 2053,7839 1864,7961 C 1738,8044 1534,8156 1253,8297 L 1239,8245 z M 2628,6698 C 2628,6662 2641,6632 2667,6608 C 2692,6583 2723,6571 2760,6571 C 2792,6571 2822,6585 2849,6612 C 2876,6638 2889,6669 2889,6703 C 2889,6739 2875,6770 2849,6795 C 2821,6819 2790,6831 2755,6831 C 2718,6831 2688,6819 2664,6792 C 2640,6766 2628,6735 2628,6698 z M 2628,7222 C 2628,7186 2641,7155 2665,7131 C 2690,7106 2721,7094 2760,7094 C 2792,7094 2821,7107 2849,7134 C 2875,7161 2889,7190 2889,7222 C 2889,7261 2876,7292 2851,7317 C 2825,7342 2795,7355 2760,7355 C 2721,7355 2690,7342 2665,7318 C 2641,7294 2628,7262 2628,7222 z",
    transform: "matrix(0.01871,0,0,0.01866,-7.18578,-58.98396)",
  },
};

export function renderClef(clefName) {
  const info = CLEF_PATHS[clefName] || CLEF_PATHS.treble;
  return `<g transform="${info.transform}"><path d="${info.d}" fill="#444" fill-rule="evenodd"/></g>`;
}

// Key signature vertical positions (octave for each accidental in standard order)
export const KS_SHARP_OCTAVES = {
  treble: [5,4,5,4,4,4,4],
  alto:   [4,4,4,3,4,3,3],
  bass:   [4,3,4,3,3,3,3],
};
export const KS_FLAT_OCTAVES = {
  treble: [4,5,4,5,4,4,4],
  alto:   [3,4,3,4,3,4,3],
  bass:   [3,3,3,3,3,3,2],
};

// ═══════════════════════════════════════════════════════════════════════════
// PURE RENDERING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function noteToY(name, octave, clef) {
  const c = CLEFS[clef] || CLEFS.treble;
  const refIdx = NOTE_NAMES.indexOf(c.ref) + c.refOct * 7;
  const noteIdx = NOTE_NAMES.indexOf(name[0]) + octave*7;
  return STAFF_TOP + 2*STAFF_LINE_GAP - (noteIdx - refIdx) * (STAFF_LINE_GAP/2);
}

export function getLedgerLines(name, octave, clef) {
  const y = noteToY(name, octave, clef);
  const bot = STAFF_TOP + 4*STAFF_LINE_GAP;
  const lines = [];
  if (y > bot + STAFF_LINE_GAP*0.4) for (let ly = bot+STAFF_LINE_GAP; ly <= y+2; ly += STAFF_LINE_GAP) lines.push(ly);
  if (y < STAFF_TOP - STAFF_LINE_GAP*0.4) for (let ly = STAFF_TOP-STAFF_LINE_GAP; ly >= y-2; ly -= STAFF_LINE_GAP) lines.push(ly);
  return lines;
}

export function renderKeySignature(clef, mode) {
  const mi = MODES[mode];
  if (!mi || mi.fifths === 0) return '';
  const count = Math.abs(mi.fifths);
  let svg = '';
  const startX = LEFT_MARGIN + CLEF_WIDTH + 2;

  if (mi.fifths > 0) {
    const octs = KS_SHARP_OCTAVES[clef] || KS_SHARP_OCTAVES.treble;
    for (let i = 0; i < count; i++) {
      const note = SHARP_ORDER[i];
      const y = noteToY(note, octs[i], clef);
      svg += `<text x="${startX + i * 10}" y="${y + 4}" font-size="14" fill="#666" font-family="serif">♯</text>`;
    }
  } else {
    const octs = KS_FLAT_OCTAVES[clef] || KS_FLAT_OCTAVES.treble;
    for (let i = 0; i < count; i++) {
      const note = FLAT_ORDER[i];
      const y = noteToY(note, octs[i], clef);
      svg += `<text x="${startX + i * 10}" y="${y + 4}" font-size="14" fill="#666" font-family="serif">♭</text>`;
    }
  }
  return svg;
}

export function renderStaffSVG({ cfNotes, cpNotes, mode, clef, cpAbove, cursor, playHead, activeVoice, issues }) {
  const totalBars = Math.max(cfNotes.length, 6);
  const keySigW = getKeySigWidth(mode);
  const contentStart = LEFT_MARGIN + CLEF_WIDTH + keySigW;
  const svgW = contentStart + totalBars * BAR_WIDTH + 30;
  const svgH = STAFF_TOP + 4*STAFF_LINE_GAP + 100;

  const errBars = new Set(issues.filter(i => i.sev==="error" && i.bar>=0).map(i => i.bar));
  const warnBars = new Set(issues.filter(i => i.sev==="warning" && i.bar>=0).map(i => i.bar));

  let svg = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display:block" role="img" aria-label="Musical staff with ${cfNotes.filter(Boolean).length} CF notes and ${cpNotes.filter(Boolean).length} CP notes">`;

  // Staff lines
  for (let i=0; i<5; i++) {
    svg += `<line x1="${LEFT_MARGIN}" y1="${STAFF_TOP+i*STAFF_LINE_GAP}" x2="${svgW-16}" y2="${STAFF_TOP+i*STAFF_LINE_GAP}" stroke="#2a2a3a" stroke-width="1"/>`;
  }
  // Clef
  svg += renderClef(clef);

  // Key signature
  svg += renderKeySignature(clef, mode);

  // Bars
  for (let i=0; i<totalBars; i++) {
    const x = contentStart+i*BAR_WIDTH;
    const isCur = i===cursor;
    const isErr = errBars.has(i);
    const isWarn = !isErr && warnBars.has(i);
    const isPlay = i===playHead;

    const fill = isPlay ? "rgba(106,158,238,.12)" : isCur ? "rgba(106,158,238,.06)" : isErr ? "rgba(200,60,60,.06)" : isWarn ? "rgba(200,170,60,.04)" : "transparent";
    const stroke = isCur ? "#3a4a6c" : "transparent";
    const dash = isCur ? "3,2" : "0";

    svg += `<g class="bar-click" data-bar="${i}" style="cursor:pointer">`;
    svg += `<rect x="${x}" y="${STAFF_TOP-24}" width="${BAR_WIDTH}" height="${4*STAFF_LINE_GAP+52}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-dasharray="${dash}"/>`;
    svg += `<text x="${x+BAR_WIDTH/2}" y="${STAFF_TOP-12}" text-anchor="middle" font-size="9" fill="${isCur?'#6a9eee':'#333'}" font-family="'JetBrains Mono',monospace">${i+1}</text>`;

    // Interval label
    if (cfNotes[i] && cpNotes[i]) {
      const intv = intervalInfo(toMidi(cfNotes[i].name,cfNotes[i].octave), toMidi(cpNotes[i].name,cpNotes[i].octave));
      const col = intv.isDissonant ? "#c44" : intv.isPerfect ? "#6a9eee" : "#7a9a6a";
      svg += `<text x="${x+BAR_WIDTH/2}" y="${svgH-10}" text-anchor="middle" font-size="9" font-family="'JetBrains Mono',monospace" font-weight="500" fill="${col}">${intv.name}</text>`;
    }

    // Empty slot indicator
    if (!cfNotes[i] && activeVoice==="cf" && isCur)
      svg += `<text x="${x+BAR_WIDTH/2}" y="${STAFF_TOP+2*STAFF_LINE_GAP+3}" text-anchor="middle" font-size="9" fill="#555">?</text>`;
    if (cfNotes[i] && !cpNotes[i] && activeVoice==="cp" && isCur)
      svg += `<text x="${x+BAR_WIDTH/2}" y="${STAFF_TOP+(cpAbove?-2:4*STAFF_LINE_GAP+12)}" text-anchor="middle" font-size="9" fill="#555">?</text>`;

    svg += `</g>`;
  }

  // CF notes
  cfNotes.forEach((n,i) => {
    if (!n) return;
    const x = contentStart+i*BAR_WIDTH+BAR_WIDTH/2, y = noteToY(n.name, n.octave, clef);
    const ldg = getLedgerLines(n.name, n.octave, clef);
    const isCur = i===cursor && activeVoice==="cf";
    ldg.forEach(ly => { svg += `<line x1="${x-10}" y1="${ly}" x2="${x+10}" y2="${ly}" stroke="#2a2a3a" stroke-width="1"/>`; });
    const fill = isCur ? "#d4a84a" : "#a08040";
    const str = errBars.has(i) ? "#c44" : isCur ? "#e8c060" : "#806830";
    svg += `<g class="note-click" data-bar="${i}" data-voice="cf" style="cursor:pointer">`;
    svg += `<ellipse cx="${x}" cy="${y}" rx="${NOTE_RY+1}" ry="${NOTE_RY-1}" fill="${fill}" stroke="${str}" stroke-width="${isCur?1.5:1}" transform="rotate(-12,${x},${y})"/>`;
    const cfAcc = getNoteAccidental(n.name, mode);
    if (cfAcc) svg += `<text x="${x-11}" y="${y+4}" font-size="12" fill="#998" font-family="serif">${cfAcc}</text>`;
    const ty = (cpAbove || !cpNotes[i]) ? y+16 : y-12;
    svg += `<text x="${x}" y="${ty}" text-anchor="middle" font-size="7.5" fill="#665" font-family="'JetBrains Mono',monospace">${n.name}${n.octave}</text>`;
    svg += `</g>`;
  });

  // CP notes
  cpNotes.forEach((n,i) => {
    if (!n) return;
    const x = contentStart+i*BAR_WIDTH+BAR_WIDTH/2, y = noteToY(n.name, n.octave, clef);
    const ldg = getLedgerLines(n.name, n.octave, clef);
    const isCur = i===cursor && activeVoice==="cp";
    ldg.forEach(ly => { svg += `<line x1="${x-10}" y1="${ly}" x2="${x+10}" y2="${ly}" stroke="#2a2a3a" stroke-width="1"/>`; });
    const fill = isCur ? "#5a9aee" : "#3a6aaa";
    const str = errBars.has(i) ? "#c44" : isCur ? "#7abaff" : "#2a5a8a";
    svg += `<g class="note-click" data-bar="${i}" data-voice="cp" style="cursor:pointer">`;
    svg += `<ellipse cx="${x}" cy="${y}" rx="${NOTE_RY+1}" ry="${NOTE_RY-1}" fill="${fill}" stroke="${str}" stroke-width="${isCur?1.5:1}" transform="rotate(-12,${x},${y})"/>`;
    const cpAcc = getNoteAccidental(n.name, mode);
    if (cpAcc) svg += `<text x="${x-11}" y="${y+4}" font-size="12" fill="#8aa" font-family="serif">${cpAcc}</text>`;
    const ty = cpAbove ? y-10 : y+16;
    svg += `<text x="${x}" y="${ty}" text-anchor="middle" font-size="7.5" fill="#568" font-family="'JetBrains Mono',monospace">${n.name}${n.octave}</text>`;
    svg += `</g>`;

  });

  // Legend
  svg += `<g transform="translate(${LEFT_MARGIN},${svgH-24})">`;
  svg += `<ellipse cx="0" cy="0" rx="4.5" ry="3.5" fill="#a08040"/><text x="8" y="3" font-size="8" fill="#555" font-family="'JetBrains Mono',monospace">CF</text>`;
  svg += `<ellipse cx="30" cy="0" rx="4.5" ry="3.5" fill="#3a6aaa"/><text x="38" y="3" font-size="8" fill="#555" font-family="'JetBrains Mono',monospace">CP</text>`;
  svg += `</g>`;

  svg += `</svg>`;

  return { svg, width: svgW, height: svgH };
}
