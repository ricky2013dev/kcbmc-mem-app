export interface FamilyFormData {
  familyName: string;
  visitedDate: string;
  registrationDate: string;
  memberStatus: 'visit' | 'member' | 'pending';
  phoneNumber: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  familyNotes: string;
  familyPicture?: string;
  lifeGroup: string;
  supportTeamMember: string;
  husband: FamilyMemberFormData;
  wife: FamilyMemberFormData;
  children: ChildFormData[];
}

export interface FamilyMemberFormData {
  koreanName: string;
  englishName: string;
  birthDate: string;
  phoneNumber: string;
  email: string;
  courses: string[];
}

export interface ChildFormData extends FamilyMemberFormData {
  gradeLevel: string;
  gradeGroup: string;
  school: string;
}

export interface SearchFilters {
  name: string;
  lifeGroup: string;
  supportTeamMember: string;
  memberStatus: string;
  dateFrom: string;
  dateTo: string;
  courses: string[];
}

export const MEMBER_STATUS_OPTIONS = [
  { value: 'visit', label: '방문' },
  { value: 'member', label: '등록' },
  { value: 'pending', label: '미정' }
];

export const STATE_OPTIONS = [
  { value: 'TX', label: 'Texas' }
];

export const COURSE_OPTIONS = [
  { value: '101', label: 'SDS 101' },
  { value: '201', label: 'SDS 201' },
  { value: '301', label: 'SDS 301' },
  { value: '401', label: 'SDS 401' }
];

export const GRADE_LEVEL_OPTIONS = [
  { value: 'B', label: 'B' },
  { value: 'Pre-K', label: 'Pre-K' },
  { value: '1', label: '1st Grade' },
  { value: '2', label: '2nd Grade' },
  { value: '3', label: '3rd Grade' },
  { value: '4', label: '4th Grade' },
  { value: '5', label: '5th Grade' },
  { value: '6', label: '6th Grade' },
  { value: '7', label: '7th Grade' },
  { value: '8', label: '8th Grade' },
  { value: '9', label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' }
];
