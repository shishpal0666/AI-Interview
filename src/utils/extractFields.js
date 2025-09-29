function findEmail(text) {
  if (!text) return null;
  const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i;
  const m = text.match(emailRe);
  return m ? m[0] : null;
}

function findPhone(text) {
  if (!text) return null;
  const phoneRe = /\+?\d[\d\s().-]{7,}\d(?:\s*(?:x|ext|extension)\s*\d{1,6})?/gi;
  let best = null;
  let m;
  while ((m = phoneRe.exec(text)) !== null) {
    const raw = m[0];
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 9) {
      best = raw.trim();
      break;
    }
  }
  return best || null;
}

function isPossibleNameLine(line) {
  if (!line) return false;
  const lowered = line.toLowerCase();
  const blacklist = ['resume', 'curriculum', 'experience', 'profile', 'summary', 'skills', 'education', 'contact', 'email', 'phone', 'interviewer', 'interviewee'];
  for (const bad of blacklist) if (lowered.includes(bad)) return false;
  if (/[0-9@]/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  for (const w of words) {
    if (/^[A-Z][a-z.'-]+$/.test(w)) continue;
    if (/^[A-Z]\.$/.test(w)) continue;
    if (/^[A-Z]{2,}$/.test(w)) continue;
    return false;
  }
  return true;
}

export default function extractFields(text) {
  if (!text || typeof text !== 'string') return { name: null, email: null, phone: null };
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const nameLabelRe = /^(?:name|full name)\s*[:-]\s*(.+)$/i;
  for (const line of lines) {
    const m = line.match(nameLabelRe);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (isPossibleNameLine(candidate)) return { name: candidate, email: findEmail(text), phone: findPhone(text) };
    }
  }
  if (lines.length) {
    const first = lines[0];
    if (isPossibleNameLine(first)) return { name: first, email: findEmail(text), phone: findPhone(text) };
  }
  for (const line of lines) {
    if (isPossibleNameLine(line)) return { name: line, email: findEmail(text), phone: findPhone(text) };
  }
  return { name: null, email: findEmail(text), phone: findPhone(text) };
}

export { extractFields };
