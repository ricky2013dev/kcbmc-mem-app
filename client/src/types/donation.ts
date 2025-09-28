export interface DonationFormData {
  familyId: string;
  familyName: string;
  amount: string;
  type: 'Regular' | 'Special';
  date: string;
  received: boolean;
  emailForThank: boolean;
  emailForTax: boolean;
  comment: string;
}

export interface DonationFilters {
  familyName: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  received: string;
  emailForThank: string;
  emailForTax: string;
}

export const DONATION_TYPE_OPTIONS = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Special', label: 'Special' }
];