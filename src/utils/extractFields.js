/**
 * Extract name, email and phone from a block of resume text.
 * Returns an object: { name: string|null, email: string|null, phone: string|null }
 *
 * Heuristics used:
 * - Email: standard email regex
 * - Phone: permissive phone regex, then validated to have at least 9 digits
 * - Name: several heuristics in order:
 *   1) Lines like "Name: John Doe" (case-insensitive)
 *   2) First non-empty line if it looks like a name (capitalized words, no digits/email)
 *   3) First line matching two-to-four capitalized words anywhere in the text
 */

function findEmail(text) {
	if (!text) return null
	const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i
	const m = text.match(emailRe)
	return m ? m[0] : null
}

function findPhone(text) {
	if (!text) return null
	// permissive phone pattern (captures international formats, separators, extensions)
	const phoneRe = /\+?\d[\d\s().-]{7,}\d(?:\s*(?:x|ext|extension)\s*\d{1,6})?/gi
	let best = null
	let m
	while ((m = phoneRe.exec(text)) !== null) {
		const raw = m[0]
		const digits = raw.replace(/\D/g, '')
		// require at least 9 digits (common minimum for phone numbers incl. country code)
		if (digits.length >= 9) {
			// choose the first long-ish match
			best = raw.trim()
			break
		}
	}
	return best || null
}

function isPossibleNameLine(line) {
	if (!line) return false
	const lowered = line.toLowerCase()
	const blacklist = [
		'resume',
		'curriculum',
		'experience',
		'profile',
		'summary',
		'skills',
		'education',
		'contact',
		'email',
		'phone',
		'interviewer',
		'interviewee',
	]
	for (const bad of blacklist) if (lowered.includes(bad)) return false
	if (/[0-9@]/.test(line)) return false

	const words = line.split(/\s+/).filter(Boolean)
	if (words.length < 2 || words.length > 4) return false

	// each word should look like a name part (capitalized or initials)
	for (const w of words) {
		if (/^[A-Z][a-z.'-]+$/.test(w)) continue // normal capitalized
		if (/^[A-Z]\.$/.test(w)) continue // initial like 'J.'
		if (/^[A-Z]{2,}$/.test(w)) continue // all-caps (acronym/company, allow but conservative)
		return false
	}
	return true
}

export default function extractFields(text) {
	if (!text || typeof text !== 'string') {
		return { name: null, email: null, phone: null }
	}

	// Normalize line endings and split
	const lines = text
		.replace(/\r/g, '')
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)

	// 1) Try labelled name lines like "Name: John Doe"
		const nameLabelRe = /^(?:name|full name)\s*[:-]\s*(.+)$/i
	for (const line of lines) {
		const m = line.match(nameLabelRe)
		if (m && m[1]) {
			const candidate = m[1].trim()
			if (isPossibleNameLine(candidate)) return { name: candidate, email: findEmail(text), phone: findPhone(text) }
		}
	}

	// 2) First non-empty line that looks like a name
	if (lines.length) {
		const first = lines[0]
		if (isPossibleNameLine(first)) {
			return { name: first, email: findEmail(text), phone: findPhone(text) }
		}
	}

	// 3) Scan for the first line anywhere that looks like a name
	for (const line of lines) {
		if (isPossibleNameLine(line)) {
			return { name: line, email: findEmail(text), phone: findPhone(text) }
		}
	}

	// fallback: no name found
	return { name: null, email: findEmail(text), phone: findPhone(text) }
}

// Also provide a named export
export { extractFields }
