export type HolidayMap = Record<string, string>;

interface HolidayFile {
  holidays?: { date: string; name: string }[];
}

export async function loadHolidays(): Promise<HolidayMap> {
  try {
    const resp = await fetch('/market_holidays.json');
    if (!resp.ok) return {};
    const data: HolidayFile = await resp.json();
    const map: HolidayMap = {};
    for (const h of data.holidays ?? []) {
      if (h.date && h.name) map[h.date] = h.name;
    }
    return map;
  } catch {
    return {};
  }
}
