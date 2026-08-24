const fs = require('fs');
const path = require('path');

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

const RESULTS_PATH = path.join(__dirname, '..', 'data', 'results.json');

const OFFICIAL_PCSO_URL = 'https://www.pcso.gov.ph/searchlottoresult.aspx';
const PRIMARY_URL = 'https://www.lottopcso.com/3d-swertres-result-history/';
const BACKUP_URL_1 = 'https://pcso-lotto-results.com/3d-swertres-result-history/';

const TODAY_PRIMARY_URL = 'https://lottobalita.com/3d-lotto/';
const TODAY_BACKUP_URL = 'https://philnews.ph/pcso-lotto-result/swertres-result/';

/**
 * Format string dates into ISO (YYYY-MM-DD)
 */
function formatDateToISO(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, '0');
    const d = slashMatch[2].padStart(2, '0');
    const y = slashMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Month DD, YYYY (e.g. "January 15, 2024")
  const textDate = new Date(clean);
  if (!isNaN(textDate.getTime())) {
    const year = textDate.getFullYear();
    const month = String(textDate.getMonth() + 1).padStart(2, '0');
    const day = String(textDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

function parseDrawCell(cellHtml) {
  const ballRegex = /<div class="(?:history-)?number-ball">(\d+)<\/div>/gi;
  const digits = [];
  let m;
  while ((m = ballRegex.exec(cellHtml)) !== null) {
    digits.push(m[1]);
  }
  if (digits.length === 3) {
    return digits.join('-');
  }
  return '--';
}

function getManilaDateISO() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch (e) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Scrape today's live results from LottoBalita
 */
async function fetchTodayFromLottoBalita(todayIso) {
  try {
    const response = await fetchWithTimeout(`${TODAY_PRIMARY_URL}?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }, 5000);

    if (!response.ok) return null;

    const html = await response.text();
    let draw2pm = '--';
    let draw5pm = '--';
    let draw9pm = '--';

    // Strategy 1: Check Top Featured Hero Card (results-container)
    const containerIdx = html.indexOf('results-container');
    if (containerIdx !== -1) {
      const endIdx = html.indexOf('Full History', containerIdx) !== -1
        ? html.indexOf('Full History', containerIdx)
        : html.indexOf('<table', containerIdx);
      const heroSection = html.slice(containerIdx, endIdx !== -1 ? endIdx : undefined);

      const dateCardMatch = heroSection.match(/<div class="results-date-inside">([\s\S]*?)<\/div>/i);
      if (dateCardMatch) {
        const cardDateStr = dateCardMatch[1].replace(/Today's Result\s*—\s*/i, '').trim();
        const cardIso = formatDateToISO(cardDateStr);

        if (cardIso === todayIso || !todayIso) {
          const drawBlocks = heroSection.split(/<div class="draw-result">/i);
          drawBlocks.forEach((block) => {
            const timeMatch = block.match(/<div class="draw-time">([^<]+)<\/div>/i);
            if (timeMatch) {
              const timeText = timeMatch[1].toUpperCase();
              const combo = parseDrawCell(block);
              if (timeText.includes('2PM')) draw2pm = combo;
              else if (timeText.includes('5PM')) draw5pm = combo;
              else if (timeText.includes('9PM')) draw9pm = combo;
            }
          });

          if (draw2pm !== '--' || draw5pm !== '--' || draw9pm !== '--') {
            return { date: cardIso || todayIso, draw2pm, draw5pm, draw9pm };
          }
        }
      }
    }

    // Strategy 2: Check JSON-LD Schema Metadata
    const jsonLdMatch = html.match(/"description":\s*"Results of 3D Lotto for ([^"]*?)\.?\s*Winning numbers:\s*([^"]+)"/i);
    if (jsonLdMatch) {
      const dateStr = jsonLdMatch[1].trim();
      const isoDate = formatDateToISO(dateStr);
      if (isoDate === todayIso) {
        const descText = jsonLdMatch[2];
        const m2 = descText.match(/2PM:\s*(\d-\d-\d)/i);
        const m5 = descText.match(/5PM:\s*(\d-\d-\d)/i);
        const m9 = descText.match(/9PM:\s*(\d-\d-\d)/i);
        if (m2) draw2pm = m2[1];
        if (m5) draw5pm = m5[1];
        if (m9) draw9pm = m9[1];

        if (draw2pm !== '--' || draw5pm !== '--' || draw9pm !== '--') {
          return { date: todayIso, draw2pm, draw5pm, draw9pm };
        }
      }
    }

    // Strategy 3: Check Table Rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const dateRegex = /<span class="history-date-text">([^<]+)<\/span>/i;
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const dateMatch = dateRegex.exec(rowHtml);
      if (!dateMatch) continue;

      const isoDate = formatDateToISO(dateMatch[1]);
      if (isoDate === todayIso || (!todayIso && isoDate)) {
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          cells.push(cellMatch[1]);
        }

        if (cells.length >= 4) {
          draw2pm = parseDrawCell(cells[1]);
          draw5pm = parseDrawCell(cells[2]);
          draw9pm = parseDrawCell(cells[3]);
          if (draw2pm !== '--' || draw5pm !== '--' || draw9pm !== '--') {
            return { date: isoDate || todayIso, draw2pm, draw5pm, draw9pm };
          }
        }
      }
    }

    return null;
  } catch (e) {
    console.log('Scraper: Today LottoBalita fetch failed:', e.message || e);
    return null;
  }
}

/**
 * Scrape today's live results from PhilNews
 */
async function fetchTodayFromPhilNews(todayIso) {
  try {
    const response = await fetchWithTimeout(`${TODAY_BACKUP_URL}?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }, 5000);

    if (!response.ok) return null;

    const html = await response.text();

    // Verify page date matches todayIso
    const pageDateMatch = html.match(/Swertres Result Today,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i) ||
                          html.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
    if (pageDateMatch) {
      const pageIso = formatDateToISO(pageDateMatch[1]);
      if (pageIso && pageIso !== todayIso) {
        return null;
      }
    }

    const cleanCombo = (raw) => {
      if (!raw) return '--';
      const text = raw.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, '');
      if (/^\d-\d-\d$/.test(text)) return text;
      return '--';
    };

    const m2pm = html.match(/id="shortcode_swertres11am_id"[^>]*>([\s\S]*?)<\/label>/i);
    const m5pm = html.match(/id="shortcode_swertres4pm_id"[^>]*>([\s\S]*?)<\/label>/i);
    const m9pm = html.match(/id="shortcode_swertres9pm_id"[^>]*>([\s\S]*?)<\/label>/i);

    const draw2pm = m2pm ? cleanCombo(m2pm[1]) : '--';
    const draw5pm = m5pm ? cleanCombo(m5pm[1]) : '--';
    const draw9pm = m9pm ? cleanCombo(m9pm[1]) : '--';

    if (draw2pm !== '--' || draw5pm !== '--' || draw9pm !== '--') {
      return { date: todayIso, draw2pm, draw5pm, draw9pm };
    }

    return null;
  } catch (e) {
    console.log('Scraper: Today PhilNews backup fetch failed:', e.message || e);
    return null;
  }
}

/**
 * Scrape from official PCSO portal (pcso.gov.ph)
 */
async function fetchFromOfficialPCSO() {
  try {
    const response = await fetchWithTimeout(`${OFFICIAL_PCSO_URL}?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }, 5000);

    if (!response.ok) return [];

    const html = await response.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const resultMap = new Map();
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }

      if (cells.length >= 3) {
        const game = cells[0];
        const comboRaw = cells[1];
        const dateRaw = cells[2];

        if (
          game.toLowerCase().includes('3d lotto') ||
          game.toLowerCase().includes('suertres') ||
          game.toLowerCase().includes('swertres')
        ) {
          const isoDate = formatDateToISO(dateRaw);
          if (!isoDate) continue;

          const combo = comboRaw.trim().replace(/\s+/g, '');
          if (!combo || combo === '-') continue;

          let existing = resultMap.get(isoDate) || {
            date: isoDate,
            draw2pm: '--',
            draw5pm: '--',
            draw9pm: '--',
          };

          if (game.includes('2PM') || game.includes('11AM')) {
            existing.draw2pm = combo;
          } else if (game.includes('5PM') || game.includes('4PM')) {
            existing.draw5pm = combo;
          } else if (game.includes('9PM')) {
            existing.draw9pm = combo;
          }

          resultMap.set(isoDate, existing);
        }
      }
    }

    return Array.from(resultMap.values());
  } catch (e) {
    console.log('Scraper: Official PCSO portal fetch offline/failed:', e.message || e);
    return [];
  }
}

/**
 * Scrape from Primary LottoBalita history source
 */
async function fetchFromPrimary() {
  try {
    const response = await fetchWithTimeout(PRIMARY_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }, 5000);

    if (!response.ok) return [];

    const html = await response.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const dateRegex = /<span class="history-date-text">([^<]+)<\/span>/i;
    const results = [];
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const dateMatch = dateRegex.exec(rowHtml);
      if (!dateMatch) continue;

      const isoDate = formatDateToISO(dateMatch[1]);
      if (!isoDate) continue;

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]);
      }

      if (cells.length >= 4) {
        let draw2pm = parseDrawCell(cells[1]);
        let draw5pm = parseDrawCell(cells[2]);
        let draw9pm = parseDrawCell(cells[3]);

        results.push({ date: isoDate, draw2pm, draw5pm, draw9pm });
      }
    }

    return results;
  } catch (e) {
    console.log('Scraper: Primary source fetch offline/failed:', e.message || e);
    return [];
  }
}

/**
 * Scrape from Secondary Backup source
 */
async function fetchFromBackupSource() {
  try {
    const response = await fetchWithTimeout(BACKUP_URL_1, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }, 5000);

    if (!response.ok) return [];

    const html = await response.text();
    const results = [];
    const datePattern = /(\d{4}-\d{2}-\d{2})|([A-Za-z]+\s+\d{1,2},\s+\d{4})/gi;
    let match;

    while ((match = datePattern.exec(html)) !== null) {
      const isoDate = formatDateToISO(match[0]) || match[0];
      if (isoDate.length === 10 && !results.some(r => r.date === isoDate)) {
        results.push({
          date: isoDate,
          draw2pm: '--',
          draw5pm: '--',
          draw9pm: '--',
        });
      }
    }

    return results;
  } catch (e) {
    console.log('Scraper: Backup source 1 fetch offline/failed:', e.message || e);
    return [];
  }
}

/**
 * Fetch history from LottoBalita
 */
async function fetchFromLottoBalitaHistory() {
  try {
    const response = await fetchWithTimeout(`https://lottobalita.com/3d-lotto/history-and-summary/?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }, 5000);

    if (!response.ok) return [];

    const html = await response.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const dateRegex = /<span class="history-date-text">([^<]+)<\/span>/i;
    const results = [];
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const dateMatch = dateRegex.exec(rowHtml);
      if (!dateMatch) continue;

      const isoDate = formatDateToISO(dateMatch[1]);
      if (!isoDate) continue;

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]);
      }

      if (cells.length >= 4) {
        const draw2pm = parseDrawCell(cells[1]);
        const draw5pm = parseDrawCell(cells[2]);
        const draw9pm = parseDrawCell(cells[3]);

        results.push({ date: isoDate, draw2pm, draw5pm, draw9pm });
      }
    }

    return results;
  } catch (e) {
    console.log('Scraper: LottoBalita history fetch offline/failed:', e.message || e);
    return [];
  }
}

/**
 * Scrape recent history from the main LottoBalita page
 */
async function fetchFromLottoBalitaMainHistory() {
  try {
    const response = await fetchWithTimeout(TODAY_PRIMARY_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }, 5000);

    if (!response.ok) return [];

    const html = await response.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const dateRegex = /<span class="history-date-text">([^<]+)<\/span>/i;
    const results = [];
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const dateMatch = dateRegex.exec(rowHtml);
      if (!dateMatch) continue;

      const isoDate = formatDateToISO(dateMatch[1]);
      if (!isoDate) continue;

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]);
      }

      if (cells.length >= 4) {
        const draw2pm = parseDrawCell(cells[1]);
        const draw5pm = parseDrawCell(cells[2]);
        const draw9pm = parseDrawCell(cells[3]);

        results.push({ date: isoDate, draw2pm, draw5pm, draw9pm });
      }
    }

    return results;
  } catch (e) {
    console.log('Scraper: LottoBalita main history fetch failed:', e.message || e);
    return [];
  }
}

/**
 * Main Fetcher: Multi-tier fallback cascade starting with LottoBalita history
 */
async function fetchLottoResults() {
  console.log('Scraper: Trying LottoBalita History...');
  let results = await fetchFromLottoBalitaHistory();
  if (results.length > 0) return results;

  console.log('Scraper: LottoBalita History failed. Trying LottoBalita Main page history...');
  results = await fetchFromLottoBalitaMainHistory();
  if (results.length > 0) return results;

  console.log('Scraper: LottoBalita down. Trying Official PCSO...');
  results = await fetchFromOfficialPCSO();
  if (results.length > 0) return results;

  console.log('Scraper: Official PCSO down/empty. Trying Primary Source...');
  results = await fetchFromPrimary();
  if (results.length > 0) return results;

  console.log('Scraper: Primary source down. Trying Backup Source 1...');
  results = await fetchFromBackupSource();
  if (results.length > 0) return results;

  return [];
}

/**
 * On-Demand Targeted Date Scraper: Fetch official results for today's date directly from PCSO using POST
 */
async function fetchSpecificDateFromPCSO(targetDateStr) {
  try {
    const parts = targetDateStr.split('-');
    const yearNum = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10);
    const dayNum = parseInt(parts[2], 10);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[monthNum - 1];

    if (!monthName || isNaN(yearNum) || isNaN(dayNum)) return null;

    const getRes = await fetchWithTimeout(`${OFFICIAL_PCSO_URL}?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }, 5000);

    if (!getRes.ok) return null;

    const html = await getRes.text();
    const vsMatch = html.match(/id="__VIEWSTATE" value="([^"]+)"/);
    const vsgMatch = html.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/);
    const evMatch = html.match(/id="__EVENTVALIDATION" value="([^"]+)"/);

    if (!vsMatch || !evMatch) return null;

    const vs = encodeURIComponent(vsMatch[1]);
    const vsg = vsgMatch ? encodeURIComponent(vsgMatch[1]) : '';
    const ev = encodeURIComponent(evMatch[1]);

    let bodyStr = `__VIEWSTATE=${vs}`;
    if (vsg) bodyStr += `&__VIEWSTATEGENERATOR=${vsg}`;
    bodyStr += `&__EVENTVALIDATION=${ev}`;
    bodyStr += `&ctl00%24ctl00%24cphContainer%24cpContent%24ddlSelectGame=0`;
    bodyStr += `&ctl00%24ctl00%24cphContainer%24cpContent%24ddlStartMonth=${encodeURIComponent(monthName)}`;
    bodyStr += `&ctl00%24ctl00%24cphContainer%24cpContent%24ddlStartDate=${dayNum}`;
    bodyStr += `&ctl00%24ctl00%24cphContainer%24cpContent%24ddlStartYear=${yearNum}`;
    bodyStr += `&ctl00%24ctl00%24cphContainer%24cpContent%24ddlEndMonth=${encodeURIComponent(monthName)}`;
    bodyStr += `&ctl00%24ctl00%24cphContainer%24cpContent%24ddlEndDay=${dayNum}`;
    bodyStr += `&ctl00%24ctl00%24cphContainer%24cpContent%24ddlEndYear=${yearNum}`;
    bodyStr += `&ctl00%24ctl00%24cphContainer%24cpContent%24btnSearch=Search+Lotto`;

    const postRes = await fetchWithTimeout(OFFICIAL_PCSO_URL, {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': OFFICIAL_PCSO_URL,
      },
      body: bodyStr,
    }, 6000);

    if (!postRes.ok) return null;

    const postHtml = await postRes.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

    let resultEntry = {
      date: targetDateStr,
      draw2pm: '--',
      draw5pm: '--',
      draw9pm: '--',
    };

    let match;
    let found = false;

    while ((match = rowRegex.exec(postHtml)) !== null) {
      const rowHtml = match[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }

      if (cells.length >= 3) {
        const game = cells[0];
        const combo = cells[1].trim().replace(/\s+/g, '');

        const gameLower = game.toLowerCase();
        if (gameLower.includes('3d lotto') || gameLower.includes('suertres') || gameLower.includes('swertres')) {
          found = true;
          if (game.includes('2PM') || game.includes('11AM')) {
            resultEntry.draw2pm = combo;
          } else if (game.includes('5PM') || game.includes('4PM')) {
            resultEntry.draw5pm = combo;
          } else if (game.includes('9PM')) {
            resultEntry.draw9pm = combo;
          }
        }
      }
    }

    return found ? resultEntry : null;
  } catch (e) {
    console.log('Scraper: Official PCSO targeted date fetch failed:', e.message || e);
    return null;
  }
}

/**
 * Today's live cascade
 */
async function fetchTodayLiveResults(todayIso) {
  let todayRes = await fetchTodayFromLottoBalita(todayIso);
  if (todayRes) return todayRes;

  console.log('Scraper: Today LottoBalita empty. Trying PhilNews backup...');
  todayRes = await fetchTodayFromPhilNews(todayIso);
  if (todayRes) return todayRes;

  console.log('Scraper: Today PhilNews empty. Trying Official PCSO targeted POST...');
  todayRes = await fetchSpecificDateFromPCSO(todayIso);
  if (todayRes) return todayRes;

  return null;
}

/**
 * Merge two results lists
 */
function mergeDrawResults(existing, scraped) {
  const mergedMap = new Map();

  existing.forEach((item) => {
    mergedMap.set(item.date, { ...item });
  });

  scraped.forEach((newItem) => {
    const existingItem = mergedMap.get(newItem.date);
    if (existingItem) {
      mergedMap.set(newItem.date, {
        date: newItem.date,
        draw2pm: newItem.draw2pm !== '--' ? newItem.draw2pm : existingItem.draw2pm,
        draw5pm: newItem.draw5pm !== '--' ? newItem.draw5pm : existingItem.draw5pm,
        draw9pm: newItem.draw9pm !== '--' ? newItem.draw9pm : existingItem.draw9pm,
      });
    } else {
      mergedMap.set(newItem.date, { ...newItem });
    }
  });

  return Array.from(mergedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

// MAIN RUNNER
async function run() {
  console.log('Starting Scraper run...');
  const todayStr = getManilaDateISO();
  console.log(`Manila Date is: ${todayStr}`);

  // Load existing results
  let existing = [];
  try {
    if (fs.existsSync(RESULTS_PATH)) {
      const fileData = fs.readFileSync(RESULTS_PATH, 'utf8');
      existing = JSON.parse(fileData);
      console.log(`Loaded ${existing.length} existing results from ${RESULTS_PATH}`);
    } else {
      console.log(`No existing file found at ${RESULTS_PATH}. Starting empty.`);
    }
  } catch (err) {
    console.error('Error loading existing results:', err.message);
  }

  // Scrape general history
  console.log('Fetching history results...');
  const scrapedHistory = await fetchLottoResults();
  console.log(`Scraped ${scrapedHistory.length} history results`);

  // Scrape today live
  console.log(`Fetching today live results for: ${todayStr}...`);
  const todayRes = await fetchTodayLiveResults(todayStr);
  if (todayRes) {
    console.log('Scraped today live results:', todayRes);
    scrapedHistory.unshift(todayRes);
  } else {
    console.log('Could not fetch today live results (yet).');
  }

  // Merge and Sort
  const merged = mergeDrawResults(existing, scrapedHistory);
  console.log(`After merge, total results: ${merged.length}`);

  // Write back to file
  try {
    const dataDir = path.dirname(RESULTS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`Successfully updated: ${RESULTS_PATH}`);
  } catch (err) {
    console.error('Error writing results to file:', err.message);
    process.exit(1);
  }
}

run();
