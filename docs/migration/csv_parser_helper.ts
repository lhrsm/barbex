export function parseCsvRows(csvText: string): number {
  let rowCount = 0;
  let inQuotes = false;
  let hasCharsInLine = false;

  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      hasCharsInLine = true;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (hasCharsInLine) {
        rowCount++;
        hasCharsInLine = false;
      }
    } else if (c !== '\n' && c !== '\r') {
      hasCharsInLine = true;
    }
  }
  if (hasCharsInLine) {
    rowCount++;
  }

  // Subtract 1 for header row
  return Math.max(0, rowCount - 1);
}
