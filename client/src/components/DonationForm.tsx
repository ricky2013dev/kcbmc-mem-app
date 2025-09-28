import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { Search, DollarSign, Calendar, FileText, User, CheckCircle, Mail, Receipt } from 'lucide-react';
import { DonationFormData, DONATION_TYPE_OPTIONS } from '@/types/donation';
import { FamilySearchPopup } from './FamilySearchPopup';

interface DonationWithDetails {
  id: string;
  familyId: string;
  amount: string;
  type: 'Regular' | 'Special';
  date: string;
  received: boolean;
  emailForThank: boolean;
  emailForTax: boolean;
  comment: string | null;
  createdAt: string;
  family: {
    id: string;
    familyName: string;
  };
  createdByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
}

interface DonationFormProps {
  donation?: DonationWithDetails | null;
  onSubmit: (data: DonationFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DonationForm({ donation, onSubmit, onCancel, isSubmitting = false }: DonationFormProps) {
  const [formData, setFormData] = useState<DonationFormData>({
    familyId: '',
    familyName: '',
    amount: '',
    type: 'Regular',
    date: new Date().toISOString().split('T')[0],
    received: true,
    emailForThank: false,
    emailForTax: false,
    comment: ''
  });

  const [isFamilySearchOpen, setIsFamilySearchOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DonationFormData, string>>>({});

  useEffect(() => {
    if (donation) {
      setFormData({
        familyId: donation.familyId,
        familyName: donation.family.familyName,
        amount: donation.amount,
        type: donation.type,
        date: donation.date,
        received: donation.received,
        emailForThank: donation.emailForThank,
        emailForTax: donation.emailForTax,
        comment: donation.comment || ''
      });
    } else {
      // Reset form for new donation
      setFormData({
        familyId: '',
        familyName: '',
        amount: '',
        type: 'Regular',
        date: new Date().toISOString().split('T')[0],
        received: true,
        emailForThank: false,
        emailForTax: false,
        comment: ''
      });
    }
    setErrors({});
  }, [donation]);

  const handleInputChange = (field: keyof DonationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBooleanChange = (field: keyof DonationFormData, value: boolean | 'indeterminate') => {
    setFormData(prev => ({ ...prev, [field]: value === true }));
  };

  const handleFamilySelect = (family: { id: string; familyName: string }) => {
    setFormData(prev => ({
      ...prev,
      familyId: family.id,
      familyName: family.familyName
    }));
    if (errors.familyId || errors.familyName) {
      setErrors(prev => ({ ...prev, familyId: undefined, familyName: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof DonationFormData, string>> = {};

    if (!formData.familyId) {
      newErrors.familyId = 'Please select a family';
    }
    if (!formData.familyName) {
      newErrors.familyName = 'Please select a family';
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0 || isNaN(parseFloat(formData.amount))) {
      newErrors.amount = 'Please enter a valid amount greater than 0';
    }
    if (!formData.date) {
      newErrors.date = 'Please select a date';
    }
    if (!formData.type) {
      newErrors.type = 'Please select a donation type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting donation:', error);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {/* Family Selection */}
          <div>
            <Label htmlFor="family">Family *</Label>
            <div className="flex gap-2">
              <Input
                id="family"
                placeholder="Select a family..."
                value={formData.familyName}
                readOnly
                className={errors.familyId ? 'border-destructive' : ''}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFamilySearchOpen(true)}
                className="shrink-0"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
            {errors.familyId && (
              <p className="text-sm text-destructive mt-1">{errors.familyId}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className={`pl-10 ${errors.amount ? 'border-destructive' : ''}`}
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-destructive mt-1">{errors.amount}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <Label htmlFor="type">Type *</Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
              <SelectTrigger className={errors.type ? 'border-destructive' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DONATION_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive mt-1">{errors.type}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <Label htmlFor="date">Date *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className={`pl-10 ${errors.date ? 'border-destructive' : ''}`}
              />
            </div>
            {errors.date && (
              <p className="text-sm text-destructive mt-1">{errors.date}</p>
            )}
          </div>

          {/* Status Fields */}
          <div>
            <Label className="text-base font-medium">Status</Label>
            <div className="space-y-3 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="received"
                  checked={formData.received}
                  onCheckedChange={(checked) => handleBooleanChange('received', checked)}
                />
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <Label htmlFor="received" className="text-sm font-normal cursor-pointer">
                    Received
                  </Label>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="emailForThank"
                  checked={formData.emailForThank}
                  onCheckedChange={(checked) => handleBooleanChange('emailForThank', checked)}
                />
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <Label htmlFor="emailForThank" className="text-sm font-normal cursor-pointer">
                    Thank You Email Sent
                  </Label>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="emailForTax"
                  checked={formData.emailForTax}
                  onCheckedChange={(checked) => handleBooleanChange('emailForTax', checked)}
                />
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-600" />
                  <Label htmlFor="emailForTax" className="text-sm font-normal cursor-pointer">
                    Tax Receipt Email Sent
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Comment */}
          <div>
            <Label htmlFor="comment">Comment</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-muted-foreground w-4 h-4" />
              <Textarea
                id="comment"
                placeholder="Optional comment..."
                value={formData.comment}
                onChange={(e) => handleInputChange('comment', e.target.value)}
                className="pl-10 min-h-[80px]"
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : donation ? 'Update Donation' : 'Add Donation'}
          </Button>
        </DialogFooter>
      </form>

      <FamilySearchPopup
        open={isFamilySearchOpen}
        onOpenChange={setIsFamilySearchOpen}
        onFamilySelect={handleFamilySelect}
      />
    </>
  );
}