/**
 * Parses a raw CSV string into an array of objects.
 * Handles quoted fields that contain commas or newlines.
 * Tags field uses pipe `|` as a separator within a value.
 *
 * @param {string} raw - The raw CSV string (e.g. from import '...csv?raw')
 * @returns {Object[]} Array of row objects keyed by the header row
 */
export function parseCSV(raw) {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    return Object.fromEntries(
      headers.map((h, i) => {
        const val = (values[i] ?? '').trim();
        // Auto-split pipe-delimited fields into arrays
        return [h, val.includes('|') ? val.split('|').map(s => s.trim()) : val];
      })
    );
  });
}

/**
 * Parses a single CSV line, respecting double-quoted fields.
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quote ""
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
