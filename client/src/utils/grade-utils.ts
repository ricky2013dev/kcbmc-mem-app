export const GRADE_GROUPS = {
  'B': 'Sprouts',
  'Pre-K': 'Dream Kid',
  '1': 'Team Kid',
  '2': 'Team Kid',
  '3': 'Team Kid',
  '4': 'Team Kid',
  '5': 'Team Kid',
  '6': 'Youth(Middle)',
  '7': 'Youth(Middle)',
  '8': 'Youth(Middle)',
  '9': 'Youth(High)',
  '10': 'Youth(High)',
  '11': 'Youth(High)',
  '12': 'Youth(High)',
} as const;

export function getGradeGroup(gradeLevel: string): string {
  return GRADE_GROUPS[gradeLevel as keyof typeof GRADE_GROUPS] || '';
}

export function generateFamilyName(husbandKoreanName: string, wifeKoreanName: string): string {
  if (!husbandKoreanName && !wifeKoreanName) return '';
  if (!husbandKoreanName) return wifeKoreanName;
  if (!wifeKoreanName) return husbandKoreanName;
  return `${husbandKoreanName}・${wifeKoreanName}`;
}

export function generateFullAddress(address: string, city: string, state: string, zipCode: string): string {
  const parts = [address, city, state, zipCode].filter(Boolean);
  return parts.join(', ');
}
