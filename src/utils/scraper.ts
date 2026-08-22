import { DrawResult } from '../data/seedData';
import { getTodayISO, getManilaHour } from './date';

const OFFICIAL_PCSO_URL = 'https://www.pcso.gov.ph/searchlottoresult.aspx';
const PRIMARY_URL = 'https://www.lottopcso.com/3d-swertres-result-history/';
const BACKUP_URL_1 = 'https://pcso-lotto-results.com/3d-swertres-result-history/';
const BACKUP_JSON_URL = 'https://raw.githubusercontent.com/pcso-results/3d-lotto/main/results.json';
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/keithjntlla/pcso-lotto-results/main/data/results.json';

const TODAY_PRIMARY_URL = 'https://lottobalita.com/3d-lotto/';
const TODAY_BACKUP_URL = 'https://philnews.ph/pcso-lotto-result/swertres-result/';

/**
 * Fetch consolidated results array from the GitHub scraper repository
 */
export async function fetchFromGitHubJSON(): Promise<DrawResult[]> {
  try {
    const response = await fetch(`${GITHUB_JSON_URL}?t=${Date.now()}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) {
      return data as DrawResult[];
    }
    return [];
  } catch (e: any) {
    console.log('Scraper: GitHub JSON fetch failed:', e?.message || e);
    return [];
  }
}

/**
 * Format string dates into ISO (YYYY-MM-DD)
 */
export function formatDateToISO(dateStr: string): string | null {
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

function parseDrawCell(cellHtml: string): string {
  const ballRegex = /<div class="(?:history-)?number-ball">(\d+)<\/div>/gi;
  const digits: string[] = [];
  let m;
  while ((m = ballRegex.exec(cellHtml)) !== null) {
    digits.push(m[1]);
  }
  if (digits.length === 3) {
    return digits.join('-');
  }
  return '--';
}

/**
 * Today's Live Scraper (Primary): Scrape today's live results from LottoBalita (lottobalita.com/3d-lotto/)
 * Uses multi-strategy parsing: Top Featured Hero Card + JSON-LD Schema Metadata + Table Rows.
 */
export async function fetchTodayFromLottoBalita(todayIso: string): Promise<DrawResult | null> {
  try {
    const response = await fetch(`${TODAY_PRIMARY_URL}?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

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

    // Strategy 2: Check JSON-LD Schema Metadata (Ensure description date matches todayIso)
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
        const cells: string[] = [];
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
  } catch (e: any) {
    console.log('Scraper: Today LottoBalita fetch failed:', e?.message || e);
    return null;
  }
}

/**
 * Today's Live Scraper (Backup): Scrape today's live results from PhilNews (philnews.ph/pcso-lotto-result/swertres-result/)
 */
export async function fetchTodayFromPhilNews(todayIso: string): Promise<DrawResult | null> {
  try {
    const response = await fetch(`${TODAY_BACKUP_URL}?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Verify page date matches todayIso
    const pageDateMatch = html.match(/Swertres Result Today,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i) ||
                          html.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
    if (pageDateMatch) {
      const pageIso = formatDateToISO(pageDateMatch[1]);
      if (pageIso && pageIso !== todayIso) {
        // Page has not updated for today yet, return null
        return null;
      }
    }

    const cleanCombo = (raw: string) => {
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
  } catch (e: any) {
    console.log('Scraper: Today PhilNews backup fetch failed:', e?.message || e);
    return null;
  }
}

/**
 * Dedicated Live Fetcher for Today's Results Screen
 * Cascade:
 * 1. LottoBalita (Primary for Today)
 * 2. PhilNews (Secondary Backup for Today)
 * 3. Official PCSO (Fallback)
 */
export async function fetchTodayLiveResults(todayIso: string): Promise<DrawResult | null> {
  // Try GitHub JSON first (contains today's live results updated by GitHub Action)
  console.log('Scraper: Trying GitHub JSON for today...');
  const githubResults = await fetchFromGitHubJSON();
  if (githubResults.length > 0) {
    const todayRes = githubResults.find((r) => r.date === todayIso);
    if (todayRes && (todayRes.draw2pm !== '--' || todayRes.draw5pm !== '--' || todayRes.draw9pm !== '--')) {
      console.log("Scraper: Successfully loaded today's results from GitHub JSON!");
      return todayRes;
    }
  }

  // 1. Primary for Today: LottoBalita
  let todayRes = await fetchTodayFromLottoBalita(todayIso);
  if (todayRes) {
    return todayRes;
  }

  console.log('Scraper: Today LottoBalita empty. Trying PhilNews backup...');
  // 2. Secondary Backup for Today: PhilNews
  todayRes = await fetchTodayFromPhilNews(todayIso);
  if (todayRes) {
    return todayRes;
  }

  console.log('Scraper: Today PhilNews empty. Trying Official PCSO...');
  // 3. Fallback to Official PCSO site
  const officialSingle = await fetchSpecificDateFromPCSO(todayIso);
  if (officialSingle) {
    return officialSingle;
  }

  return null;
}

/**
 * Tier 1 Primary Scraper: Scrape directly from official PCSO portal (pcso.gov.ph)
 */
async function fetchFromOfficialPCSO(): Promise<DrawResult[]> {
  try {
    const response = await fetch(`${OFFICIAL_PCSO_URL}?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const resultMap = new Map<string, DrawResult>();
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
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
  } catch (e: any) {
    console.log('Scraper: Official PCSO portal fetch offline/failed:', e?.message || e);
    return [];
  }
}

/**
 * On-Demand Targeted Date Scraper: Fetch official results for any specific date (e.g. pre-2020)
 */
export async function fetchSpecificDateFromPCSO(targetDateStr: string): Promise<DrawResult | null> {
  try {
    const [yearStr, monthStr, dayStr] = targetDateStr.split('-');
    const yearNum = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const dayNum = parseInt(dayStr, 10);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[monthNum - 1];

    if (!monthName || isNaN(yearNum) || isNaN(dayNum)) return null;

    const getRes = await fetch(`${OFFICIAL_PCSO_URL}?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

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

    const postRes = await fetch(OFFICIAL_PCSO_URL, {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': OFFICIAL_PCSO_URL,
      },
      body: bodyStr,
    });

    if (!postRes.ok) return null;

    const postHtml = await postRes.text();

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

    let resultEntry: DrawResult = {
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
      const cells: string[] = [];
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
  } catch (e: any) {
    console.log('Scraper: On-demand date fetch offline/failed:', e?.message || e);
    return null;
  }
}

/**
 * Tier 2: Scrape from Primary LottoBalita source
 */
async function fetchFromPrimary(): Promise<DrawResult[]> {
  try {
    const response = await fetch(PRIMARY_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const dateRegex = /<span class="history-date-text">([^<]+)<\/span>/i;
    const results: DrawResult[] = [];
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const dateMatch = dateRegex.exec(rowHtml);
      if (!dateMatch) continue;

      const isoDate = formatDateToISO(dateMatch[1]);
      if (!isoDate) continue;

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
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
  } catch (e: any) {
    console.log('Scraper: Primary source fetch offline/failed:', e?.message || e);
    return [];
  }
}

/**
 * Tier 3: Scrape from Secondary Backup source
 */
async function fetchFromBackupSource(): Promise<DrawResult[]> {
  try {
    const response = await fetch(BACKUP_URL_1, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const results: DrawResult[] = [];
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
  } catch (e: any) {
    console.log('Scraper: Backup source 1 fetch offline/failed:', e?.message || e);
    return [];
  }
}

/**
 * Tier 4: Fetch from JSON API fallback
 */
async function fetchFromJSONFallback(): Promise<DrawResult[]> {
  try {
    const response = await fetch(BACKUP_JSON_URL);
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) {
      return data as DrawResult[];
    }
    return [];
  } catch (e: any) {
    console.log('Scraper: Backup JSON API fetch offline/failed:', e?.message || e);
    return [];
  }
}

/**
 * Tier 5: Fetch history from LottoBalita
 */
async function fetchFromLottoBalitaHistory(): Promise<DrawResult[]> {
  try {
    const response = await fetch(`https://lottobalita.com/3d-lotto/history-and-summary/?t=${Date.now()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const dateRegex = /<span class="history-date-text">([^<]+)<\/span>/i;
    const results: DrawResult[] = [];
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const dateMatch = dateRegex.exec(rowHtml);
      if (!dateMatch) continue;

      const isoDate = formatDateToISO(dateMatch[1]);
      if (!isoDate) continue;

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
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
  } catch (e: any) {
    console.log('Scraper: LottoBalita history fetch offline/failed:', e?.message || e);
    return [];
  }
}

/**
 * Scrape recent history (last 5-10 days) from the main LottoBalita page (https://lottobalita.com/3d-lotto/)
 * This is smaller (~93 KB) and more reliable on mobile devices than the full 1MB history page.
 */
async function fetchFromLottoBalitaMainHistory(): Promise<DrawResult[]> {
  try {
    const response = await fetch(TODAY_PRIMARY_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const dateRegex = /<span class="history-date-text">([^<]+)<\/span>/i;
    const results: DrawResult[] = [];
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const dateMatch = dateRegex.exec(rowHtml);
      if (!dateMatch) continue;

      const isoDate = formatDateToISO(dateMatch[1]);
      if (!isoDate) continue;

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
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
  } catch (e: any) {
    console.log('Scraper: LottoBalita main history fetch failed:', e?.message || e);
    return [];
  }
}

/**
 * Main Fetcher: Multi-tier fallback cascade starting with LottoBalita history (provides 400+ days)
 */
export async function fetchLottoResults(): Promise<DrawResult[]> {
  // Try GitHub JSON first (contains full history + today's results)
  console.log('Scraper: Trying GitHub JSON...');
  const githubResults = await fetchFromGitHubJSON();
  if (githubResults.length > 0) {
    console.log(`Scraper: Successfully loaded ${githubResults.length} historical results from GitHub JSON!`);
    return applyTimeGuards(githubResults);
  }

  // 1. Try LottoBalita history first as it is extremely stable and provides a long backlog
  console.log('Scraper: Trying LottoBalita History...');
  let results = await fetchFromLottoBalitaHistory();
  if (results.length > 0) {
    return applyTimeGuards(results);
  }

  // 1b. Fallback to LottoBalita Main page history (last 5-10 days) which is smaller and extremely reliable
  console.log('Scraper: LottoBalita History failed. Trying LottoBalita Main page history...');
  results = await fetchFromLottoBalitaMainHistory();
  if (results.length > 0) {
    return applyTimeGuards(results);
  }

  // 2. Fallback to Official PCSO site
  console.log('Scraper: LottoBalita down. Trying Official PCSO...');
  results = await fetchFromOfficialPCSO();
  if (results.length > 0) {
    return applyTimeGuards(results);
  }

  // 3. Fallback to Primary Source
  console.log('Scraper: Official PCSO down/empty. Trying Primary Source...');
  results = await fetchFromPrimary();
  if (results.length > 0) {
    return applyTimeGuards(results);
  }

  // 4. Fallback to Backup Source 1
  console.log('Scraper: Primary source down. Trying Backup Source 1...');
  results = await fetchFromBackupSource();
  if (results.length > 0) {
    return applyTimeGuards(results);
  }

  // 5. Fallback to JSON API
  console.log('Scraper: Backup Source 1 down. Trying Backup JSON API...');
  results = await fetchFromJSONFallback();
  if (results.length > 0) {
    return applyTimeGuards(results);
  }

  return [];
}

/**
 * Apply time guards to prevent displaying invalid/placeholder draws before draw time occurs today
 */
function applyTimeGuards(results: DrawResult[]): DrawResult[] {
  const todayStr = getTodayISO();
  const currentHour = getManilaHour();

  return results.map((item) => {
    if (item.date === todayStr) {
      return {
        ...item,
        draw2pm: currentHour < 14 ? '--' : item.draw2pm,
        draw5pm: currentHour < 17 ? '--' : item.draw5pm,
        draw9pm: currentHour < 21 ? '--' : item.draw9pm,
      };
    }
    return item;
  }).sort((a, b) => b.date.localeCompare(a.date));
}
