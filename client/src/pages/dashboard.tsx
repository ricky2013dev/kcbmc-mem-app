import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SundayDatePicker } from '@/components/sunday-date-picker';
import { apiRequest } from '@/lib/queryClient';
import { FamilyWithMembers } from '@shared/schema';
import { SearchFilters, MEMBER_STATUS_OPTIONS, COURSE_OPTIONS } from '@/types/family';
import { formatDateForInput, getPreviousSunday } from '@/utils/date-utils';
import { getGradeGroupFirstChar } from '@/utils/grade-utils';
import { Users, Search, Plus, Edit, LogOut, ChevronDown, ChevronUp, Phone, MessageSquare, MapPin, Printer, X, Home, Check, Settings, Globe, AlertCircle, Menu, Bell, ExternalLink, User, BookOpen, Calendar, Save, GraduationCap, Info } from 'lucide-react';
import styles from './dashboard.module.css';
import { CareLogList } from '@/components/CareLogList';
import { RefreshButton } from '@/components/RefreshButton';

// Helper function to get default date range (recent 12 months, Sunday-only)
function getDefaultDateRange() {
  const today = new Date();
  const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 12, today.getDate());
  
  // Get the most recent Sunday from today
  const dateTo = getPreviousSunday(today);
  
  // Get the first Sunday from 12 months ago
  const dateFrom = getPreviousSunday(twelveMonthsAgo);
  
  return {
    dateFrom: formatDateForInput(dateFrom),
    dateTo: formatDateForInput(dateTo)
  };
}

interface AnnouncementWithStaff {
  id: string;
  title: string;
  content: string;
  type: 'Major' | 'Medium' | 'Minor';
  isLoginRequired: boolean;
  startDate: string;
  endDate: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, logout, updateUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultDateRange = getDefaultDateRange();

  const [filters, setFilters] = useState<SearchFilters>({
    name: '',
    lifeGroup: '',
    supportTeamMember: '',
    memberStatus: 'all',
    dateFrom: defaultDateRange.dateFrom,
    dateTo: defaultDateRange.dateTo,
    courses: []
  });

  const [hasSearched, setHasSearched] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [magnifiedImage, setMagnifiedImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<'thisWeek' | 'lastWeek' | 'lastMonth' | 'last3Months' | null>(null);
  const [selectedMemberStatuses, setSelectedMemberStatuses] = useState<Set<string>>(new Set());
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [showFamilyNotesProtectionModal, setShowFamilyNotesProtectionModal] = useState(false);
  const [hasAgreedToFamilyNotesProtection, setHasAgreedToFamilyNotesProtection] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementWithStaff | null>(null);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [majorAnnouncementModal, setMajorAnnouncementModal] = useState<AnnouncementWithStaff | null>(null);
  const [shownMajorAnnouncements, setShownMajorAnnouncements] = useState<Set<string>>(new Set());
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAnnouncementDropdown, setShowAnnouncementDropdown] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    fullName: '',
    nickName: '',
    email: '',
    personalPin: ''
  });
  const [editingFamilyNotes, setEditingFamilyNotes] = useState<string | null>(null);
  const [familyNotesText, setFamilyNotesText] = useState('');
  const [expandedGradeGroups, setExpandedGradeGroups] = useState<Set<string>>(new Set());

  const { data: families = [], isLoading } = useQuery<FamilyWithMembers[]>({
    queryKey: ['families', filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      
      if (filters.name) queryParams.append('name', filters.name);
      if (filters.lifeGroup) queryParams.append('lifeGroup', filters.lifeGroup);
      if (filters.supportTeamMember) queryParams.append('supportTeamMember', filters.supportTeamMember);
      if (filters.memberStatus && filters.memberStatus !== 'all') queryParams.append('memberStatus', filters.memberStatus);
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
      if (filters.courses && filters.courses.length > 0) queryParams.append('courses', filters.courses.join(','));
      queryParams.append('sortBy', 'visitedDate');
      queryParams.append('sortOrder', 'desc');
      
      const url = `/api/families?${queryParams.toString()}`;
      const response = await apiRequest('GET', url);
      return response.json();
    },
    enabled: hasSearched,
  });

  const { data: allAnnouncements = [] } = useQuery<AnnouncementWithStaff[]>({
    queryKey: ['announcements/active'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/announcements/active');
      return response.json();
    },
  });

  // Query for ALL announcements (including inactive) for footer display
  const { data: footerAnnouncements = [] } = useQuery<AnnouncementWithStaff[]>({
    queryKey: ['announcements/all'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/announcements');
      const announcements = await response.json();
      // Filter only active announcements
      return announcements.filter((ann: any) => ann.isActive);
    },
  });

  // Filter announcements for dashboard banners (login required = true)
  const dashboardAnnouncements = allAnnouncements.filter(a => a.isLoginRequired);
  
  // Filter major announcements that should be shown as modals
  const majorAnnouncements = allAnnouncements.filter(a => a.type === 'Major' && a.isLoginRequired);

  // Show major announcements as modal when they load
  useEffect(() => {
    if (majorAnnouncements.length > 0) {
      const unshownMajorAnnouncement = majorAnnouncements.find(
        announcement => !shownMajorAnnouncements.has(announcement.id)
      );
      
      if (unshownMajorAnnouncement && !majorAnnouncementModal) {
        setMajorAnnouncementModal(unshownMajorAnnouncement);
        setShownMajorAnnouncements(prev => new Set(prev).add(unshownMajorAnnouncement.id));
      }
    }
  }, [majorAnnouncements, shownMajorAnnouncements, majorAnnouncementModal]);

  // Update time every second for real-time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  // Helper function to mask text with asterisks - show max 10 asterisks for any note
  const maskText = (text: string) => {
    if (!text) return '';
    return '*'.repeat(Math.min(text.length, 10));
  };

  // Function to handle showing family notes protection modal
  const handleViewFamilyNotes = () => {
    if (!hasAgreedToFamilyNotesProtection) {
      setShowFamilyNotesProtectionModal(true);
    }
  };

  const handleAgreeToProtection = () => {
    setHasAgreedToFamilyNotesProtection(true);
    setShowFamilyNotesProtectionModal(false);
  };

  const handleCancelProtection = () => {
    setShowFamilyNotesProtectionModal(false);
  };

  // Handle opening profile edit modal
  const handleEditProfile = async () => {
    // Check if user is authenticated before showing edit form
    try {
      await apiRequest('GET', '/api/auth/me');
      setEditProfileData({
        fullName: user?.fullName || '',
        nickName: user?.nickName || '',
        email: user?.email || '',
        personalPin: ''
      });
      setShowUserProfileModal(false);
      setShowEditProfileModal(true);
    } catch (error) {
      console.error('Auth check failed when opening edit modal:', error);
      setShowUserProfileModal(false);
      toast({
        title: "Authentication Required",
        description: "Please log in again to edit your profile.",
        variant: "destructive",
      });
      // Redirect to login
      logout();
    }
  };

  // Handle profile update
  const handleUpdateProfile = async () => {
    try {
      const response = await apiRequest('PUT', '/api/auth/profile', editProfileData);
      const updatedUser = await response.json();
      
      // Update user data in context and localStorage
      updateUser({
        fullName: updatedUser.fullName,
        nickName: updatedUser.nickName,
        email: updatedUser.email,
        // Don't update other fields that weren't changed
      });
      
      toast({
        title: "Profile updated",
      });
      
      setShowEditProfileModal(false);
    } catch (error) {
      console.error('Profile update failed:', error);
      toast({
        title: "Error",
        description: error.message.includes('401') ? 
          "Please log in again to update your profile." : 
          "Failed to update profile. Please try again.",
        variant: "destructive",
      });
      
      if (error.message.includes('401')) {
        logout();
      }
    }
  };

  // Family notes update mutation
  const updateFamilyNotesMutation = useMutation({
    mutationFn: async ({ familyId, familyNotes }: { familyId: string; familyNotes: string }) => {
      const response = await apiRequest('PUT', `/api/families/${familyId}`, { familyNotes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families', filters] });
      toast({
        title: "Family notes updated",
      });
      setEditingFamilyNotes(null);
      setFamilyNotesText('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update family notes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditFamilyNotes = (family: FamilyWithMembers) => {
    setEditingFamilyNotes(family.id);
    setFamilyNotesText(family.familyNotes || '');
  };

  const handleSaveFamilyNotes = (familyId: string) => {
    updateFamilyNotesMutation.mutate({ familyId, familyNotes: familyNotesText });
  };

  const handleCancelFamilyNotesEdit = () => {
    setEditingFamilyNotes(null);
    setFamilyNotesText('');
  };

  const clearFilters = () => {
    const defaultDateRange = getDefaultDateRange();
    setFilters({
      name: '',
      lifeGroup: '',
      supportTeamMember: '',
      memberStatus: 'all',
      dateFrom: defaultDateRange.dateFrom,
      dateTo: defaultDateRange.dateTo,
      courses: []
    });
    setSelectedQuickFilter(null);
    setSelectedMemberStatuses(new Set());
    setSelectedCourses(new Set());
    setHasSearched(true);
  };

  const toggleMemberStatus = (status: string) => {
    const newSelected = new Set(selectedMemberStatuses);
    if (newSelected.has(status)) {
      newSelected.delete(status);
    } else {
      newSelected.add(status);
    }
    setSelectedMemberStatuses(newSelected);
    
    // Update the filter based on selected statuses
    // If no statuses selected or if both 'visit' and 'member' are selected, show all
    const memberStatusFilter = 
      newSelected.size === 0 || 
      (newSelected.has('visit') && newSelected.has('member')) 
        ? 'all' 
        : Array.from(newSelected).join(',');
    setFilters(prev => ({ 
      ...prev, 
      memberStatus: memberStatusFilter 
    }));
    setHasSearched(true);
  };

  const toggleCourse = (course: string) => {
    const newSelected = new Set(selectedCourses);
    if (newSelected.has(course)) {
      newSelected.delete(course);
    } else {
      newSelected.add(course);
    }
    setSelectedCourses(newSelected);
    
    // Update the filter based on selected courses
    setFilters(prev => ({ 
      ...prev, 
      courses: Array.from(newSelected) 
    }));
    setHasSearched(true);
  };


  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'member': return 'default';
      case 'visit': return 'default';
      case 'pending': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case 'member': return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
      case 'visit': return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
      case 'pending': return '';
      default: return '';
    }
  };
  const getStatusBorderClassName = (status: string) => {
    switch (status) {
      case 'member': return 'border-blue-200';
      case 'visit': return 'border-green-200';
      case 'pending': return 'border-gray-300';
      default: return 'border-primary/20';
    }
  };

  const getStatusDisplayLabel = (status: string) => {
    const option = MEMBER_STATUS_OPTIONS.find(opt => opt.value === status);
    return option ? option.label : status;
  };

  const getActiveFilters = () => {
    const activeFilters = [];
    
    // if (filters.dateFrom) {
    //   activeFilters.push({ label: 'From', value: filters.dateFrom });
    // }
    // if (filters.dateTo) {
    //   activeFilters.push({ label: 'To', value: filters.dateTo });
    // }
    if (filters.name) {
      activeFilters.push({ label: 'Name', value: filters.name });
    }
    if (filters.supportTeamMember) {
      activeFilters.push({ label: 'Support Team', value: filters.supportTeamMember });
    }
    if (filters.memberStatus && filters.memberStatus !== 'all') {
      const statusLabel = getStatusDisplayLabel(filters.memberStatus);
      activeFilters.push({ label: 'Status', value: statusLabel });
    }
    if (filters.courses && filters.courses.length > 0) {
      const coursesLabel = filters.courses.map(course => {
        const courseOption = COURSE_OPTIONS.find(opt => opt.value === course);
        return courseOption ? courseOption.label : course;
      }).join(', ');
      activeFilters.push({ label: 'Courses', value: coursesLabel });
    }
    
    return activeFilters;
  };

  const getChildGrades = (family: FamilyWithMembers) => {
    const children = family.members.filter(member => 
      member.relationship === 'child' && member.gradeLevel
    );
    const grades = children.map(child => child.gradeLevel).filter(Boolean);
    return grades.length > 0 ? grades.join(',') : null;
  };

  const hasAddress = (family: FamilyWithMembers) => {
    return family.address || family.city || family.state || family.zipCode;
  };

  const getPhoneCount = (family: FamilyWithMembers) => {
    const husband = family.members.find(m => m.relationship === 'husband');
    const wife = family.members.find(m => m.relationship === 'wife');
    let count = 0;
    if (husband?.phoneNumber) count++;
    if (wife?.phoneNumber) count++;
    return count;
  };

  const getPrimaryCourses = (family: FamilyWithMembers) => {
    const husband = family.members.find(m => m.relationship === 'husband');
    const wife = family.members.find(m => m.relationship === 'wife');
    
    // Check husband first (if he has a name)
    if (husband && (husband.koreanName || husband.englishName)) {
      return {
        person: 'husband',
        personName: husband.koreanName || husband.englishName || '남편',
        courses: husband.courses || []
      };
    }
    
    // If no husband or husband has no name, use wife
    if (wife) {
      return {
        person: 'wife',
        personName: wife.koreanName || wife.englishName || '아내',
        courses: wife.courses || []
      };
    }
    
    return null;
  };

  const getCourseCount = (family: FamilyWithMembers) => {
    const coursesInfo = getPrimaryCourses(family);
    return coursesInfo ? coursesInfo.courses.length : 0;
  };

  const toggleFamilyExpanded = (familyId: string) => {
    setExpandedFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(familyId)) {
        newSet.delete(familyId);
      } else {
        newSet.add(familyId);
      }
      return newSet;
    });
  };

  const toggleGradeGroup = (childId: string) => {
    setExpandedGradeGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(childId)) {
        newSet.delete(childId);
      } else {
        newSet.add(childId);
      }
      return newSet;
    });
  };

  const printSearchResults = () => {
    const printContent = `
      <html>
        <head>
          <title>Family Search Results</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
            .search-info { color: #666; margin-bottom: 5px; }
            .results-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .results-table th { background: #f5f5f5; padding: 8px; border: 1px solid #ddd; font-weight: bold; text-align: left; }
            .results-table td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; }
            .results-table tr:nth-child(even) { background: #f9f9f9; }
            @media print { body { margin: 0; } .results-table { font-size: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Family Search Results</div>
            <div class="search-info">Date Range: ${filters.dateFrom || 'N/A'} to ${filters.dateTo || 'N/A'}</div>
            <div class="search-info">Total Results: ${families.length}</div>
            <div class="search-info">Generated: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <table class="results-table">
            <thead>
              <tr>
                <th>Family Name</th>
                <th>Visited Date</th>
                <th>Children</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Supporter</th>
              </tr>
            </thead>
            <tbody>
              ${families.map(family => {
                const children = family.members.filter(m => m.relationship === 'child');
                const husband = family.members.find(m => m.relationship === 'husband');
                const wife = family.members.find(m => m.relationship === 'wife');
                
                const fullAddress = [
                  family.address,
                  family.city,
                  family.state,
                  family.zipCode
                ].filter(Boolean).join(',');
                
                const phoneInfo = [];
                if (husband?.phoneNumber) phoneInfo.push(`H: ${husband.phoneNumber}`);
                if (wife?.phoneNumber) phoneInfo.push(`W: ${wife.phoneNumber}`);
                
                const childrenInfo = children.map(child => {
                  const name = child.koreanName && child.englishName 
                    ? `${child.koreanName} (${child.englishName})`
                    : child.koreanName || child.englishName || '';
                  const grade = child.gradeLevel || '';
                  const gradeGroup = child.gradeGroup || '';
                  let childInfo = name;
                  if (grade) {
                    childInfo += ` [${grade}`;
                    if (gradeGroup) {
                      childInfo += ` ${gradeGroup}`;
                    }
                    childInfo += ']';
                  }
                  return childInfo;
                }).join(', ');
                
                return `
                  <tr>
                    <td><strong>${family.familyName}</strong></td>
                    <td>${family.visitedDate}</td>
                    <td>${childrenInfo || '-'}</td>
                    <td>${fullAddress || '-'}</td>
                    <td>${phoneInfo.join(', ') || '-'}</td>
                    <td>${family.supportTeamMember || '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const printFamilyInfo = (family: FamilyWithMembers) => {
    const children = family.members.filter(m => m.relationship === 'child');
    const childrenInfo = children.map(child => {
      const name = child.koreanName && child.englishName 
        ? `${child.koreanName} (${child.englishName})`
        : child.koreanName || child.englishName || '';
      const grade = child.gradeLevel || '';
      const gradeGroup = child.gradeGroup || '';
      return { name, grade, gradeGroup };
    });

    const fullAddress = [
      family.address,
      family.city,
      family.state,
      family.zipCode
    ].filter(Boolean).join(', ');

    const husband = family.members.find(m => m.relationship === 'husband');
    const wife = family.members.find(m => m.relationship === 'wife');

    const printContent = `
      <html>
        <head>
          <title>Family Information - ${family.familyName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 20px; }
            .header-content { flex: 1; }
            .family-picture { width: 120px; height: 120px; border: 2px solid #ddd; border-radius: 8px; object-fit: cover; }
            .dummy-picture { width: 120px; height: 120px; border: 2px solid #ddd; border-radius: 8px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; color: #999; font-size: 48px; }
            .family-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #333; }
            .child-item { margin: 5px 0; padding: 5px; border-left: 3px solid #4CAF50; background: #f9f9f9; }
            .contact-item { margin: 5px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; }
            .notes { background: #f0f8ff; padding: 15px; border-radius: 5px; white-space: pre-wrap; }
            .supporter { background: #fff3cd; padding: 8px; border-radius: 4px; font-weight: bold; color: #856404; margin-top: 10px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              ${family.familyPicture ? `
                <img src="${family.familyPicture}" alt="${family.familyName} family" class="family-picture" />
              ` : `
                <div class="dummy-picture">
                  👤
                </div>
              `}
            </div>
            <div class="header-content">
              <div class="family-name">${family.familyName}</div>
              <div>Visited: ${family.visitedDate}</div>
              ${family.supportTeamMember ? `
                <div class="supporter">Support Team: ${family.supportTeamMember}</div>
              ` : ''}
            </div>
          </div>
          
          ${fullAddress || husband?.phoneNumber || wife?.phoneNumber ? `
          <div class="section">
            <div class="section-title">Contact Information</div>
            ${fullAddress ? `
              <div class="contact-item">
                <strong>Address:</strong> ${fullAddress}
              </div>
            ` : ''}
            ${husband?.phoneNumber ? `
              <div class="contact-item">
                <strong>Husband Phone:</strong> ${husband.phoneNumber}
              </div>
            ` : ''}
            ${wife?.phoneNumber ? `
              <div class="contact-item">
                <strong>Wife Phone:</strong> ${wife.phoneNumber}
              </div>
            ` : ''}
          </div>
          ` : ''}
          
          ${childrenInfo.length > 0 ? `
          <div class="section">
            ${childrenInfo.map(child => `
              <div class="child-item">
                <strong>${child.name}</strong>
                ${child.grade ? ` - Grade: ${child.grade}` : ''}
                ${child.gradeGroup ? ` (${child.gradeGroup.substring(0, 3)})` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${family.familyNotes ? `
          <div class="section">
            <div class="section-title">Family Notes</div>
            <div class="notes">${family.familyNotes}</div>
          </div>
          ` : ''}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'Major': return 'destructive';
      case 'Medium': return 'default';
      case 'Minor': return 'secondary';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const handleDismissAnnouncement = (announcementId: string) => {
    setDismissedAnnouncements(prev => new Set(prev).add(announcementId));
  };

  const visibleAnnouncements = dashboardAnnouncements.filter(
    announcement => !dismissedAnnouncements.has(announcement.id) && announcement.type !== 'Major'
  );

  return (
    <div className={styles.container}>
      {/* Navigation Header */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLeft}>
            <div className={styles.navIcon}>
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className={styles.navTitle}>Member</h1>
          </div>
          
          {/* Announcements & Refresh Button - Center */}
          <div className="flex-1 flex justify-center items-center gap-12">
            {/* News Announcement Bell */}
            {footerAnnouncements.length > 0 && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    if (footerAnnouncements.length === 1) {
                      setLocation(`/announcement/${footerAnnouncements[0].id}`);
                    } else {
                      setShowAnnouncementDropdown(!showAnnouncementDropdown);
                    }
                  }}
                  title={footerAnnouncements.length === 1 
                    ? `View announcement: ${footerAnnouncements[0].title}` 
                    : `${footerAnnouncements.length} announcements available`}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                
                {/* Notification badge */}
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {footerAnnouncements.length > 9 ? '9+' : footerAnnouncements.length}
                </div>
                
                {/* Dropdown for multiple announcements */}
                {footerAnnouncements.length > 1 && showAnnouncementDropdown && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowAnnouncementDropdown(false)}
                    />
                    
                    {/* Dropdown content */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="p-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Announcements</h3>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {footerAnnouncements.map((announcement) => (
                          <div
                            key={announcement.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0"
                            onClick={() => {
                              setLocation(`/announcement/${announcement.id}`);
                              setShowAnnouncementDropdown(false);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {announcement.title}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(announcement.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            <RefreshButton onRefresh={() => setExpandedFamilies(new Set())} />
          </div>
          
          <div className={styles.navRight}>
            {/* Add New Button - Desktop Only */}
            <Button 
              variant="default"
              size="sm"
              onClick={() => setLocation('/family/new')}
              data-testid="button-add-family"
              className="mr-2 hidden md:flex"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
            {/* Desktop Menu - Hidden on Mobile */}
            <div className="hidden md:flex items-center space-x-4">
              {user?.group === 'ADM' && (
                <div className="flex space-x-2">
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={() => setLocation('/staff-management')}
                    data-testid="button-staff-management"
                    className="text-blue-700 hover:text-primary-foreground/80"
                    title="Staff Management"
                  >
                    <Settings className="w-4 h-4" />Staff
                  </Button>
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={() => setLocation('/news-management')}
                    data-testid="button-news-management"
                    className="text-green-700 hover:text-primary-foreground/80"
                    title="News Management"
                  >
                    <Globe className="w-4 h-4" />News
                  </Button>

                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={() => setLocation('/events')}
                    data-testid="button-events"
                    className="text-purple-700 hover:text-primary-foreground/80"
                    title="Event Management"
                  >
                    <Calendar className="w-4 h-4" /> Event
                  </Button>
                </div>
              )}
              <span className={styles.userName} data-testid="text-current-user">
                {user?.group === 'ADM' ? user?.group : `${user?.fullName} (${user?.group})`}
              </span>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => logout()}
                className={styles.logoutButton}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-1" />
                <span>Logout</span>
              </Button>
            </div>

            {/* Mobile Hamburger Menu */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="lg" className="p-3">
                    <Menu className="w-7 h-7 stroke-[4px] text-blue-600 font-black" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 text-sm font-medium text-gray-900 border-b">
                    {user?.group === 'ADM' ? user?.group : `${user?.fullName} (${user?.group})`}
                  </div>
                  
                  <DropdownMenuItem onClick={() => setLocation('/family/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Family
                  </DropdownMenuItem>
                  
                  {user?.group === 'ADM' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setLocation('/staff-management')}>
                        <Settings className="w-4 h-4 mr-2" />
                        Staff 
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation('/news-management')}>
                        <Globe className="w-4 h-4 mr-2" />
                        News 
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation('/events')}>
                        <Calendar className="w-4 h-4 mr-2" />
                        Events 
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Announcement Banners */}
      {visibleAnnouncements.length > 0 && (
        <div className="px-4 py-2 space-y-2">
          {visibleAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                announcement.type === 'Major' 
                  ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                  : announcement.type === 'Medium' 
                  ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => setSelectedAnnouncement(announcement)}
            >
              <div className="flex items-center space-x-3 flex-1">
                <AlertCircle 
                  className={`w-5 h-5 ${
                    announcement.type === 'Major' 
                      ? 'text-red-600' 
                      : announcement.type === 'Medium' 
                      ? 'text-blue-600' 
                      : 'text-gray-600'
                  }`} 
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {announcement.title}
                    </h4>
                    <Badge variant={getTypeBadgeVariant(announcement.type)} className="text-xs">
                      {announcement.type}
                    </Badge>
                  </div>
                  <p className="text-gray-600 text-xs truncate max-w-md">
                    {announcement.content.replace(/<[^>]*>/g, '')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismissAnnouncement(announcement.id);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className={styles.main}>
        {/* Search Section */}
        {showFilters && (
        <Card className={styles.searchCard}>
          <CardHeader className={!showFilters ? styles.searchHeaderCompact : ''}>
            <div className={styles.searchHeader}>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className={styles.toggleButton}
                data-testid="button-toggle-filters"
              >
                {showFilters ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2 text-blue-600" />
                    <span className="text-blue-600">Hide Filters</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2 text-blue-600" />
                    <span className="text-blue-600">Search Filters</span>
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className={styles.searchContent}>
              {/* Quick Date Filter Buttons - Moved to top */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button
                  variant={selectedQuickFilter === 'thisWeek' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const thisWeekSunday = getPreviousSunday(today);
                    const dateString = formatDateForInput(thisWeekSunday);
                    setFilters(prev => ({ 
                      ...prev, 
                      dateFrom: dateString, 
                      dateTo: dateString 
                    }));
                    setSelectedQuickFilter('thisWeek');
                  }}
                  className={`text-xs flex items-center gap-1 ${
                    selectedQuickFilter === 'thisWeek' 
                      ? 'bg-green-600 text-white hover:bg-green-700 border-green-600' 
                      : ''
                  }`}
                >
                  {selectedQuickFilter === 'thisWeek' && <Check className="w-3 h-3" />}
                  This Week
                </Button>
                <Button
                  variant={selectedQuickFilter === 'lastWeek' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const thisWeekSunday = getPreviousSunday(today);
                    const lastWeekSunday = new Date(thisWeekSunday);
                    lastWeekSunday.setDate(thisWeekSunday.getDate() - 7);
                    const dateString = formatDateForInput(lastWeekSunday);
                    setFilters(prev => ({ 
                      ...prev, 
                      dateFrom: dateString, 
                      dateTo: dateString 
                    }));
                    setSelectedQuickFilter('lastWeek');
                  }}
                  className={`text-xs flex items-center gap-1 ${
                    selectedQuickFilter === 'lastWeek' 
                      ? 'bg-green-600 text-white hover:bg-green-700 border-green-600' 
                      : ''
                  }`}
                >
                  {selectedQuickFilter === 'lastWeek' && <Check className="w-3 h-3" />}
                  Last Week
                </Button>
                <Button
                  variant={selectedQuickFilter === 'lastMonth' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                    const dateFrom = formatDateForInput(getPreviousSunday(lastMonth));
                    const dateTo = formatDateForInput(getPreviousSunday(lastMonthEnd));
                    setFilters(prev => ({ 
                      ...prev, 
                      dateFrom: dateFrom, 
                      dateTo: dateTo 
                    }));
                    setSelectedQuickFilter('lastMonth');
                  }}
                  className={`text-xs flex items-center gap-1 ${
                    selectedQuickFilter === 'lastMonth' 
                      ? 'bg-green-600 text-white hover:bg-green-700 border-green-600' 
                      : ''
                  }`}
                >
                  {selectedQuickFilter === 'lastMonth' && <Check className="w-3 h-3" />}
                  Last Month
                </Button>
                <Button
                  variant={selectedQuickFilter === 'last3Months' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
                    const dateFrom = formatDateForInput(getPreviousSunday(threeMonthsAgo));
                    const dateTo = formatDateForInput(getPreviousSunday(today));
                    setFilters(prev => ({ 
                      ...prev, 
                      dateFrom: dateFrom, 
                      dateTo: dateTo 
                    }));
                    setSelectedQuickFilter('last3Months');
                  }}
                  className={`text-xs flex items-center gap-1 ${
                    selectedQuickFilter === 'last3Months' 
                      ? 'bg-green-600 text-white hover:bg-green-700 border-green-600' 
                      : ''
                  }`}
                >
                  {selectedQuickFilter === 'last3Months' && <Check className="w-3 h-3" />}
                  Last 3 Months
                </Button>
                
                {/* Member Status Quick Filters - Multi-selection */}
                <Button
                  variant={selectedMemberStatuses.has('visit') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleMemberStatus('visit')}
                  className={`text-xs flex items-center gap-1 ${
                    selectedMemberStatuses.has('visit') 
                      ? 'bg-green-600 text-white hover:bg-green-700 border-green-600' 
                      : ''
                  }`}
                >
                  {selectedMemberStatuses.has('visit') && <Check className="w-3 h-3" />}
                  방문
                </Button>
                <Button
                  variant={selectedMemberStatuses.has('member') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleMemberStatus('member')}
                  className={`text-xs flex items-center gap-1 ${
                    selectedMemberStatuses.has('member') 
                      ? 'bg-green-600 text-white hover:bg-green-700 border-green-600' 
                      : ''
                  }`}
                >
                  {selectedMemberStatuses.has('member') && <Check className="w-3 h-3" />}
                  등록
                </Button>
                <Button
                  variant={selectedMemberStatuses.has('pending') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleMemberStatus('pending')}
                  className={`text-xs flex items-center gap-1 ${
                    selectedMemberStatuses.has('pending') 
                      ? 'bg-green-600 text-white hover:bg-green-700 border-green-600' 
                      : ''
                  }`}
                >
                  {selectedMemberStatuses.has('pending') && <Check className="w-3 h-3" />}
                  미정
                </Button>
              </div>

              {/* Courses Filter - Always Visible */}
              <div className="mt-3 md:mt-3 mt-2">
                <Label className="text-sm">미수료</Label>
                <div className="flex gap-1 mt-1 md:mt-2">
                  {COURSE_OPTIONS.map((course) => (
                    <Button
                      key={course.value}
                      variant={selectedCourses.has(course.value) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleCourse(course.value)}
                      className={`h-7 px-2 text-xs flex items-center gap-1 ${
                        selectedCourses.has(course.value) 
                          ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600' 
                          : ''
                      }`}
                    >
                      {selectedCourses.has(course.value) && <Check className="w-3 h-3" />}
                      {course.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Additional Filters - Conditionally Visible */}
              {showMoreFilters && (
                <div className="space-y-4">
                  {/* Date Range */}
                  <div className={styles.dateGrid}>
                    <div>
                      <Label htmlFor="dateFrom">방문일 (From)</Label>
                      <SundayDatePicker
                        value={filters.dateFrom}
                        onChange={(value) => {
                          setFilters(prev => ({ ...prev, dateFrom: value }));
                          setHasSearched(true);
                        }}
                        data-testid="input-date-from"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="dateTo">방문일(To)</Label>
                      <SundayDatePicker
                        value={filters.dateTo}
                        onChange={(value) => {
                          setFilters(prev => ({ ...prev, dateTo: value }));
                          setHasSearched(true);
                        }}
                        data-testid="input-date-to"
                      />
                    </div>
                  </div>

                  {/* Other filters */}
                  <div className={styles.searchGrid}>
                    <div>
                      <Label htmlFor="name">이름</Label>
                      <Input
                        id="name"
                        placeholder="Search by name..."
                        value={filters.name}
                        onChange={(e) => {
                          setFilters(prev => ({ ...prev, name: e.target.value }));
                          setHasSearched(true);
                        }}
                        data-testid="input-search-name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="supportTeam">섬김이</Label>
                      <Input
                        id="supportTeam"
                        placeholder="Support team member..."
                        value={filters.supportTeamMember}
                        onChange={(e) => {
                          setFilters(prev => ({ ...prev, supportTeamMember: e.target.value }));
                          setHasSearched(true);
                        }}
                        data-testid="input-search-support-team"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Filter Actions */}
              <div className={styles.searchActions}>
                <Button variant="secondary" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear 
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowMoreFilters(!showMoreFilters)}
                  className="text-blue-600 hover:text-blue-700 border-blue-600"
                >
                  {showMoreFilters ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-2 text-blue-600" />
                      Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2 text-blue-600" />
                      More
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
        )}

        {/* Results Section */}
        <Card className={styles.resultsCard}>
          <CardHeader className={`${styles.resultsHeader} py-2 px-4`}>
            <div className="flex items-center justify-between min-h-0">
              <div className="flex items-center gap-2">
                <h4 className={styles.resultsTitle}> Results {hasSearched && (
                  < >
                    : {families.length} 
                  </>
                )}</h4>
                {hasSearched && families.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={printSearchResults}
                    title="Print Search Results"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                  >
                    <Printer className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {!showFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowFilters(true)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ChevronDown className="w-4 h-4 mr-2 text-blue-600" />
                  Change Filters
                </Button>
              )}
            </div>
            
            {/* Active Filters Display */}
            {hasSearched && getActiveFilters().length > 0 && (
              <div className="flex flex-nowrap gap-1 pt-1 mt-1 border-t border-border overflow-x-auto">
                <span className="text-xs font-medium text-muted-foreground mr-1 flex-shrink-0"></span>
                {getActiveFilters().map((filter, index) => (
                  <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0.5 whitespace-nowrap flex-shrink-0">
                    <span className="font-medium">{filter.label}:</span>
                    <span className="ml-0.5">{filter.value}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          
          {!hasSearched ? (
            <CardContent className={styles.emptyState}>
              <div className={styles.emptyContent}>
                <Search className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No search performed</h3>
                <p className="text-muted-foreground">Use the search filters above to find families.</p>
              </div>
            </CardContent>
          ) : isLoading ? (
            <CardContent className={styles.loadingState}>
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-center text-muted-foreground">Searching families...</p>
            </CardContent>
          ) : families.length === 0 ? (
            <CardContent className={styles.emptyState}>
              <div className={styles.emptyContent}>
                <Users className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No families found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria.</p>
              </div>
            </CardContent>
          ) : (
            <div className={styles.familyList}>
              {families.map((family) => (
                <div key={family.id} className={styles.familyCard} data-testid={`card-family-${family.id}`}>
                  <div 
                    className={styles.familyContent}
                  >
                    <div className={styles.familyInfo} onClick={() => toggleFamilyExpanded(family.id)}>
                      <div className={styles.familyAvatar}>
                        {family.familyPicture ? (
                          <img 
                            src={family.familyPicture} 
                            alt={`${family.familyName} family`}
                            className="w-12 h-12 object-cover rounded-full border-2 border-border"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                              if (fallback) fallback.style.display = 'block';
                            }}
                          />
                        ) : null}
                        <Users className={`w-6 h-6 text-muted-foreground ${family.familyPicture ? 'fallback-icon hidden' : ''}`} />
                      </div>
                      
                      <div className={styles.familyDetails}>
                        <div className={styles.familyLine1}>
                          <div className="flex items-center gap-2">
                            <h4 className={styles.familyName} data-testid={`text-family-name-${family.id}`}>
                              {family.familyName}
                            </h4>

                          </div>
                          <div className="flex items-center gap-2">
                            <div className={styles.familyBadges}>
                            <Badge 
                              variant={getStatusBadgeVariant(family.memberStatus)}
                              className={getStatusBadgeClassName(family.memberStatus)}
                            >
                              {getStatusDisplayLabel(family.memberStatus)}&nbsp;
                                {(() => {
                                  // Parse date string to avoid timezone issues
                                  const [year, month, day] = family.visitedDate.split('-').map(Number);
                                  const date = new Date(year, month - 1, day);
                                  return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
                                })()}
                            </Badge>
                              {family.supportTeamMember && (
                                <Badge variant="outline" className={styles.supportTeamBadge}>
                                  {family.supportTeamMember}
                                </Badge>
                              )}
                              {!expandedFamilies.has(family.id) && getChildGrades(family) && (
                                <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200">
                                  {getChildGrades(family)}
                                </Badge>
                              )}

                              {!expandedFamilies.has(family.id) && getCourseCount(family) > 0 && (
                                <div className="relative">
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    <BookOpen className="w-3 h-3" />
                                  </Badge>
                                  <div className="absolute -top-1 -right-1 h-4 w-4 border border-orange-200 text-orange-700 text-xs rounded-full flex items-center justify-center font-medium bg-white">
                                    {getCourseCount(family) > 9 ? '9+' : getCourseCount(family)}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {expandedFamilies.has(family.id) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFamilyExpanded(family.id);
                                }}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                title="Collapse"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {expandedFamilies.has(family.id) && (
                      <div className={styles.expandedContent}>
                        <Tabs defaultValue="current-info" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="current-info">가족사항 </TabsTrigger>
                            
                            <TabsTrigger value="care-logs">섬김이 로그</TabsTrigger>
                            <TabsTrigger value="family-notes">추가정보</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="current-info" className="mt-4">
                            <div className={styles.familyDetailsExpanded}>
                              {/* Large Family Picture */}
                              {family.familyPicture && (
                                <div className="mb-6 flex justify-center">
                                  <div 
                                    className="relative cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMagnifiedImage({
                                        src: family.familyPicture!,
                                        alt: `${family.familyName} family`
                                      });
                                    }}
                                  >
                                    <img 
                                      src={family.familyPicture} 
                                      alt={`${family.familyName} family`}
                                      className={`w-32 h-32 object-cover rounded-lg border-4 ${getStatusBorderClassName(family.memberStatus)} shadow-lg`}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1.5 hover:bg-opacity-70 transition-all">
                                      <Search className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className={styles.contactInfo}>
                                {(() => {
                                  const husband = family.members.find(m => m.relationship === 'husband');
                                  const wife = family.members.find(m => m.relationship === 'wife');
                                  const hasPhoneNumber = husband?.phoneNumber || wife?.phoneNumber;
                                  
                                  return (
                                    <div className={styles.infoItem}>
                                      <div className="flex flex-wrap gap-2">
                                        {hasPhoneNumber ? (
                                          <>
                                            {husband?.phoneNumber && (
                                              <>
                                                <Badge 
                                                  variant="outline" 
                                                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer text-sm font-medium px-3 py-1"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`tel:${husband.phoneNumber}`, '_self');
                                                  }}
                                                  title="Click to call husband"
                                                >
                                                  <Phone className="h-3 w-3 mr-1" />
                                                  H: {husband.phoneNumber}
                                                </Badge>
                                                <Badge 
                                                  variant="outline" 
                                                  className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`sms:${husband.phoneNumber}`, '_self');
                                                  }}
                                                  title="Click to text husband"
                                                >
                                                  <MessageSquare className="h-3 w-3 mr-1" />
                                                  Text
                                                </Badge>
                                              </>
                                            )}
                                            {wife?.phoneNumber && (
                                              <>
                                                <Badge 
                                                  variant="outline" 
                                                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer text-sm font-medium px-3 py-1"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`tel:${wife.phoneNumber}`, '_self');
                                                  }}
                                                  title="Click to call wife"
                                                >
                                                  <Phone className="h-3 w-3 mr-1" />
                                                  W: {wife.phoneNumber}
                                                </Badge>
                                                <Badge 
                                                  variant="outline" 
                                                  className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`sms:${wife.phoneNumber}`, '_self');
                                                  }}
                                                  title="Click to text wife"
                                                >
                                                  <MessageSquare className="h-3 w-3 mr-1" />
                                                  Text
                                                </Badge>
                                              </>
                                            )}
                                          </>
                                        ) : (
                                          <Badge variant="secondary" className="text-muted-foreground">
                                            <Phone className="h-3 w-3 mr-1" />
                                            No phone
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const fullAddress = [
                                    family.address,
                                    family.city,
                                    family.state
                                  ].filter(Boolean).join(', ');
                                  
                                  return (
                                    <div className={styles.infoItem}>
                                      <div className="flex flex-wrap gap-2">
                                        {fullAddress ? (
                                          <Badge 
                                            variant="outline" 
                                            className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 cursor-pointer py-2 px-2 h-auto whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
                                              window.open(mapsUrl, '_blank');
                                            }}
                                            title="Click to open in Google Maps"
                                          >
                                            <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                            <span className="truncate">{fullAddress}</span>
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-muted-foreground">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            No address
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const children = family.members.filter(m => m.relationship === 'child');
                                  return children.length > 0 && (
                                    <div className={styles.infoItem}>
                                      
                                      <div className="flex flex-wrap gap-2">
                                        {children.map((child, index) => (
                                          <div key={child.id || index} className="bg-green-50 border border-green-200 rounded px-2 py-1 text-sm">
                                            <div className="font-medium flex items-center gap-2"
                                            onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleGradeGroup(child.id || `${family.id}-${index}`);
                                                }}
                                                >
                                              <span 
                                                className="cursor-pointer hover:text-blue-600 transition-colors text-xs"
                                                
                                              >
                                                {child.koreanName && child.englishName 
                                                  ? `${child.koreanName} (${child.englishName})`
                                                  : child.koreanName || child.englishName
                                                }
                                              </span>
                                              {child.gradeLevel && (
                                                <div className="relative">
                                                  <Badge  className="bg-green-50 text-green-700 border-green-200">
                                                    <GraduationCap className="w-3 h-3" />
                                                  </Badge>
                                                  <div className="absolute -top-1 -right-1 h-4 w-4 border border-green-200 text-green-700 text-xs rounded-full flex items-center justify-center font-medium bg-white">
                                                    {getGradeGroupFirstChar(child.gradeLevel) || (index + 1)}
                                                  </div>
                                                </div>
                                              )}
                                              {child.gradeGroup && expandedGradeGroups.has(child.id || `${family.id}-${index}`) && (
                                                <span className={`flex items-center gap-1 text-xs ${
                                                  child.gradeGroup.toLowerCase().includes('team') 
                                                    ? 'text-purple-600' 
                                                    : child.gradeGroup.toLowerCase().includes('kid') 
                                                    ? 'text-orange-600' 
                                                    : child.gradeGroup.toLowerCase().includes('high') 
                                                    ? 'text-indigo-600' 
                                                    : child.gradeGroup.toLowerCase().includes('youth') 
                                                    ? 'text-red-600' 
                                                    : 'text-blue-600'
                                                }`}>
                                                  <Info className={`h-2.5 w-2.5 ${
                                                    child.gradeGroup.toLowerCase().includes('team') 
                                                      ? 'text-purple-600' 
                                                      : child.gradeGroup.toLowerCase().includes('kid') 
                                                      ? 'text-orange-600' 
                                                      : child.gradeGroup.toLowerCase().includes('high') 
                                                      ? 'text-indigo-600' 
                                                      : child.gradeGroup.toLowerCase().includes('youth') 
                                                      ? 'text-red-600' 
                                                      : 'text-blue-600'
                                                  }`} />
                                                  ({child.gradeGroup})
                                                </span>
                                              )}
                                            </div>

                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const coursesInfo = getPrimaryCourses(family);
                                  return coursesInfo && coursesInfo.courses.length > 0 && (
                                    <div className={styles.infoItem}>
                                      <div className="flex flex-wrap gap-2">
                                        {coursesInfo.courses.map((courseValue, index) => {
                                          const courseOption = COURSE_OPTIONS.find(opt => opt.value === courseValue);
                                          const courseLabel = courseOption ? courseOption.label : courseValue;
                                          
                                          return (
                                            <Badge 
                                              key={`${courseValue}-${index}`} 
                                              variant="default" 
                                              className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
                                            >
                                              {courseLabel}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                              
                              <div className={styles.familyActions}>
                                <Button 
                                  size="sm"
                                  variant="default"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLocation(`/family/${family.id}/edit`);
                                  }}
                                  data-testid={`button-edit-${family.id}`}
                                  className={styles.editButton}
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    printFamilyInfo(family);
                                  }}
                                  title="Print Family Information"
                                >
                                  <Printer className="w-3 h-3 mr-1" />
                                  Print
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFamilyExpanded(family.id);
                                  }}
                                  title="Close"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Close
                                </Button>
                              </div>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="family-notes" className="mt-4">
                            <div className="space-y-4">
                              {family.familyNotes || editingFamilyNotes === family.id ? (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex justify-between items-center mb-2">
                                    <h5 className="font-medium text-blue-900">Family Notes</h5>
                                    {hasAgreedToFamilyNotesProtection && editingFamilyNotes !== family.id && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditFamilyNotes(family)}
                                        className="text-blue-600 hover:text-blue-800"
                                        title="Edit family notes"
                                      >
                                        <Edit className="w-3 h-3 mr-1" />
                                        Edit
                                      </Button>
                                    )}
                                  </div>
                                  
                                  {editingFamilyNotes === family.id ? (
                                    <div className="space-y-3">
                                      <Textarea
                                        value={familyNotesText}
                                        onChange={(e) => setFamilyNotesText(e.target.value)}
                                        placeholder="Enter family notes..."
                                        rows={4}
                                        className="w-full text-blue-800 bg-white"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() => handleSaveFamilyNotes(family.id)}
                                          disabled={updateFamilyNotesMutation.isPending}
                                          className="bg-blue-600 hover:bg-blue-700"
                                        >
                                          <Save className="w-3 h-3 mr-1" />
                                          {updateFamilyNotesMutation.isPending ? 'Saving...' : 'Save'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={handleCancelFamilyNotesEdit}
                                          disabled={updateFamilyNotesMutation.isPending}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : hasAgreedToFamilyNotesProtection ? (
                                    <div 
                                      className="text-blue-800 whitespace-pre-wrap"
                                      title="Notes are visible"
                                    >
                                      {family.familyNotes || 'No notes available'}
                                    </div>
                                  ) : (
                                    <div onClick={handleViewFamilyNotes}>
                                      <div 
                                        className="text-blue-800 whitespace-pre-wrap cursor-pointer hover:bg-blue-100 p-2 rounded transition-colors"
                                        title="Click to agree to protection terms and view notes"
                                      >
                                        {maskText(family.familyNotes || '')}
                                      </div>
                                      <p className="text-sm text-blue-600 mt-2 italic">
                                        🔒 Click above to view protected notes
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-muted-foreground">
                                  <div className="space-y-3">
                                    <p>No family notes available</p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditFamilyNotes(family)}
                                      className="text-gray-600 hover:text-gray-800"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Add Notes
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="staff-notes" className="mt-4">
                            <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-muted-foreground">
                              <p>Staff notes functionality will be implemented later.</p>
                              <p className="text-sm mt-2">This will include internal staff communications and follow-up actions.</p>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="care-logs" className="mt-4">
                            <CareLogList familyId={family.id} />
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Magnified Image Dialog */}
      <Dialog open={!!magnifiedImage} onOpenChange={() => setMagnifiedImage(null)}>
        <DialogContent className="max-w-4xl p-4 [&>button]:w-10 [&>button]:h-10 [&>button]:text-lg sm:[&>button]:w-12 sm:[&>button]:h-12 sm:[&>button]:text-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Family Image</DialogTitle>
            <DialogDescription>Enlarged view of the family photo</DialogDescription>
          </DialogHeader>
          {magnifiedImage && (
            <div className="flex justify-center">
              <img 
                src={magnifiedImage.src} 
                alt={magnifiedImage.alt}
                className="w-[90%] sm:max-w-full max-h-[80vh] object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Announcement Detail Modal */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="max-w-2xl">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedAnnouncement.title}
                  <Badge variant={getTypeBadgeVariant(selectedAnnouncement.type)} className="text-xs">
                    {selectedAnnouncement.type}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  View full announcement details and information
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
                />
                <div className="text-xs text-gray-500 pt-4 border-t">
                  <p>Posted by: {selectedAnnouncement.createdByStaff.fullName}</p>
                  <p>Active until: {formatDate(selectedAnnouncement.endDate)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setSelectedAnnouncement(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Major Announcement Modal */}
      <Dialog open={!!majorAnnouncementModal} onOpenChange={() => setMajorAnnouncementModal(null)}>
        <DialogContent className="max-w-2xl">
          {majorAnnouncementModal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  {majorAnnouncementModal.title}
                  <Badge variant="destructive" className="text-xs">
                    {majorAnnouncementModal.type}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Important announcement that requires your attention
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: majorAnnouncementModal.content }}
                />
                <div className="text-xs text-gray-500 pt-4 border-t">
                  <p>Posted by: {majorAnnouncementModal.createdByStaff.fullName}</p>
                  <p>Active until: {formatDate(majorAnnouncementModal.endDate)}</p>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setMajorAnnouncementModal(null);
                    // Check if there are more major announcements to show
                    const nextMajorAnnouncement = majorAnnouncements.find(
                      announcement => !shownMajorAnnouncements.has(announcement.id)
                    );
                    if (nextMajorAnnouncement) {
                      setTimeout(() => {
                        setMajorAnnouncementModal(nextMajorAnnouncement);
                        setShownMajorAnnouncements(prev => new Set(prev).add(nextMajorAnnouncement.id));
                      }, 100);
                    }
                  }}
                >
                  {majorAnnouncements.filter(a => !shownMajorAnnouncements.has(a.id)).length > 1 ? 'Next' : 'OK'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Family Notes Protection Modal */}
      <Dialog open={showFamilyNotesProtectionModal} onOpenChange={handleCancelProtection}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              Family notes are protected.
            </DialogTitle>
            <DialogDescription className="sr-only">
              Family notes protection agreement modal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-gray-600 text-lg mb-6">
                Do not share confidential information with others.
              </p>
            </div>
            
            <div className="space-y-3 text-gray-700">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-gray-400 mt-2 flex-shrink-0"></div>
                <p>This information contains sensitive family care notes</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-gray-400 mt-2 flex-shrink-0"></div>
                <p>Strictly confidential - authorized staff only</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-gray-400 mt-2 flex-shrink-0"></div>
                <p>Do not discuss, copy, or distribute</p>
              </div>

            </div>
            
            <div className="flex space-x-3 pt-4">

              <Button
                onClick={handleAgreeToProtection}
                className="flex-1 py-3 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white"
              >
                I Agree
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fixed Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLeft}>
            <span className={styles.footerDate}>
              {(() => {
                const dateStr = currentTime.toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit'
                });
                const weekdayStr = currentTime.toLocaleDateString('en-US', {
                  weekday: 'long'
                }).toUpperCase();
                const timeStr = currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                }).toUpperCase();
                return `${dateStr.toUpperCase()} ${weekdayStr} ${timeStr}`;
              })()}
            </span>
          </div>
          
          {/* Empty center space */}
          <div className="flex-1 flex justify-center">
          </div>
          
          <div className={styles.footerRight}>
            <div 
              className={`${styles.footerUser} flex items-center gap-2 cursor-pointer`}
              onClick={() => setShowUserProfileModal(true)}
              title="Click to view profile"
            >
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                <User className="w-3 h-3 text-white drop-shadow-sm" />
              </div>
              <span className="text-blue-600 font-medium text-sm tracking-wide drop-shadow-sm">
                {user?.group === 'ADM' ? user?.group : `${user?.fullName} (${user?.group})`}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* User Profile Modal */}
      <Dialog open={showUserProfileModal} onOpenChange={setShowUserProfileModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              User Profile
            </DialogTitle>
            <DialogDescription>
              View your profile information and account details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* User Information */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Full Name:</span>
                  <span className="font-semibold text-gray-900">{user?.fullName || 'N/A'}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Nickname:</span>
                  <span className="font-semibold text-gray-900">{user?.nickName || 'N/A'}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Email:</span>
                  <span className="font-medium text-gray-700">{user?.email || 'N/A'}</span>
                </div>
                

                
  
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="default"
                size="sm"
                onClick={handleEditProfile}
                className="flex-1"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setShowUserProfileModal(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>

            {/* Last Login Info */}
            <div className="text-xs text-gray-500 text-center pt-2 border-t">
              Session started: {new Date().toLocaleString()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={showEditProfileModal} onOpenChange={setShowEditProfileModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                <Edit className="w-5 h-5 text-white" />
              </div>
              Edit Profile
            </DialogTitle>
            <DialogDescription>
              Update your profile information including name, email, and PIN
            </DialogDescription>
          </DialogHeader>
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateProfile();
            }}
            className="space-y-4"
          >
            {/* Full Name - Read Only */}
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                autoComplete="name"
                value={editProfileData.fullName}
                readOnly
                disabled
                className="bg-gray-50 cursor-not-allowed"
                placeholder="Full name (read-only)"
              />
            </div>

            {/* Nickname */}
            <div className="space-y-2">
              <Label htmlFor="edit-nickName">Nickname</Label>
              <Input
                id="edit-nickName"
                autoComplete="nickname"
                value={editProfileData.nickName}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, nickName: e.target.value }))}
                placeholder="Enter your nickname"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                autoComplete="email"
                value={editProfileData.email}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email address"
              />
            </div>

            {/* Personal PIN */}
            <div className="space-y-2">
              <Label htmlFor="edit-pin">Personal PIN</Label>
              <Input
                id="edit-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="new-password"
                value={editProfileData.personalPin}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, personalPin: e.target.value.replace(/\D/g, "") }))}
                placeholder="••••"
              />
              <p className="text-xs text-gray-500">
                Leave blank to keep your current PIN
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit"
                variant="default"
                className="flex-1"
                disabled={!editProfileData.nickName.trim()}
              >
                <Check className="w-4 h-4 mr-2" />
                Update Profile
              </Button>
              
              <Button 
                type="button"
                variant="outline"
                onClick={() => setShowEditProfileModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
