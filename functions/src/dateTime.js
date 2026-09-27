// Existing Korean display strings are accepted only with an explicit Korea-time interpretation.
export function parseMoyoungDate(value, end = false) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?:\s*~\s*(\d{1,2}):(\d{2}))?)?$/);
  if (!match) {
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const [, y, m, d, h, min, eh, em] = match;
  const hour = Number(end && eh ? eh : h ?? (end ? 23 : 0));
  const minute = Number(end && em ? em : min ?? (end ? 59 : 0));
  const day = new Date(Date.UTC(+y, +m - 1, +d));
  if (+m < 1 || +m > 12 || +d < 1 || day.getUTCDate() !== +d || hour > 23 || minute > 59) return null;
  return Date.UTC(+y, +m - 1, +d, hour - 9, minute, !h && end ? 59 : 0, !h && end ? 999 : 0);
}
export function scheduleTimes(data) {
  const text = data.eventDate ?? data.event_date;
  const startsAtMs = parseMoyoungDate(data.startsAtMs ?? data.starts_at_ms ?? data.startsAt ?? text);
  const explicitEnd = data.endsAtMs ?? data.ends_at_ms;
  const endsAtMs = explicitEnd !== undefined ? parseMoyoungDate(explicitEnd)
    : typeof text === 'string' && text.includes('~') ? parseMoyoungDate(text, true)
    : startsAtMs === null ? null : startsAtMs + 86400000;
  return { startsAtMs, endsAtMs };
}
