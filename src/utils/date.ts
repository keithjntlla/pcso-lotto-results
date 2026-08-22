/**
 * Returns today's date formatted as YYYY-MM-DD in Philippine Standard Time (Asia/Manila, UTC+8)
 */
export function getTodayISO(): string {
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
 * Returns current hour (0-23) in Philippine Standard Time (Asia/Manila, UTC+8)
 */
export function getManilaHour(): number {
  try {
    const str = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    return parseInt(str, 10);
  } catch (e) {
    return new Date().getHours();
  }
}
