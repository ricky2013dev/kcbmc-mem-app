export function getNextSunday(date?: Date): Date {
  const d = date ? new Date(date) : new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getPreviousSunday(date?: Date): Date {
  const d = date ? new Date(date) : new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : day;
  d.setDate(d.getDate() - diff);
  return d;
}

export function isSunday(date: Date | string): boolean {
  let d: Date;
  if (typeof date === 'string') {
    // Parse YYYY-MM-DD format properly to avoid timezone issues
    const parts = date.split('-');
    d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else {
    d = date;
  }
  return d.getDay() === 0;
}

export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getAllSundaysInRange(startDate: Date, endDate: Date): Date[] {
  const sundays: Date[] = [];
  const current = new Date(startDate);
  
  // Find first Sunday
  if (!isSunday(current)) {
    current.setDate(current.getDate() + (7 - current.getDay()));
  }
  
  while (current <= endDate) {
    sundays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  return sundays;
}

export function validateSundayOnly(dateString: string): boolean {
  if (!dateString) return true; // Allow empty dates
  return isSunday(dateString);
}

export function getSundayValidationMessage(dateString: string): string {
  if (!dateString) return '';
  // Parse YYYY-MM-DD format properly to avoid timezone issues
  const parts = dateString.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (!isSunday(date)) {
    const nextSunday = getNextSunday(date);
    return `Please select a Sunday. Next available Sunday is ${formatDateForInput(nextSunday)}.`;
  }
  return '';
}
