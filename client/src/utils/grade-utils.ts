export const GRADE_GROUPS = {
  'B': 'Sprouts',
  'Pre-K': 'Dream Kid',
  'K': 'Dream Kid',
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
  'C': 'College/Young Adult',
} as const;

export function getGradeGroup(gradeLevel: string): string {
  return GRADE_GROUPS[gradeLevel as keyof typeof GRADE_GROUPS] || '';
}

export function getGradeGroupFirstChar(gradeLevel: string): string {
  const gradeGroup = getGradeGroup(gradeLevel);
  if (!gradeGroup) return '';
  
  // Handle special cases for consistent first characters
  if (gradeGroup.includes('Team Kid')) return 'T';
  if (gradeGroup.includes('Youth')) return 'Y';
  if (gradeGroup.includes('Dream Kid')) return 'D';
  if (gradeGroup.includes('Sprouts')) return 'S';
  if (gradeGroup.includes('College')) return 'C';
  
  return gradeGroup.charAt(0).toUpperCase();
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

export function calculateGradeLevelFromBirthdate(birthdate: string): string {
  if (!birthdate || birthdate.length !== 10) return '';
  
  const birth = new Date(birthdate);
  const today = new Date();
  
  // Calculate age as of September 1st of current school year
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-based
  
  // Determine the school year (Sept 1 - Aug 31)
  const schoolYear = currentMonth >= 8 ? currentYear : currentYear - 1; // August is month 7 (0-based)
  const schoolYearStart = new Date(schoolYear, 8, 1); // September 1st
  
  // Calculate age as of school year start
  let age = schoolYearStart.getFullYear() - birth.getFullYear();
  const monthDiff = schoolYearStart.getMonth() - birth.getMonth();
  const dayDiff = schoolYearStart.getDate() - birth.getDate();
  
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  
  // Map age to grade level (US school system)
  if (age <= 2) return 'B';
  if (age === 3) return 'B';
  if (age === 4) return 'Pre-K';
  if (age === 5) return 'K';
  if (age === 6) return '1';
  if (age === 7) return '2';
  if (age === 8) return '3';
  if (age === 9) return '4';
  if (age === 10) return '5';
  if (age === 11) return '6';
  if (age === 12) return '7';
  if (age === 13) return '8';
  if (age === 14) return '9';
  if (age === 15) return '10';
  if (age === 16) return '11';
  if (age === 17) return '12';
  if (age >= 18) return 'C';
  
  return '';
}
