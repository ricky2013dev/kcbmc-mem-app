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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SundayDatePicker } from '@/components/sunday-date-picker';
import { apiRequest } from '@/lib/queryClient';

import { FamilyWithMembers, Department, Team } from '@server/schema';
import { SearchFilters, MEMBER_STATUS_OPTIONS, COURSE_OPTIONS } from '@/types/family';
import { formatDateForInput, getPreviousSunday } from '@/utils/date-utils';
import { getGradeGroupFirstChar } from '@/utils/grade-utils';
import { Users, Search, Plus, Edit, Copy, LogOut, ChevronDown, ChevronUp, Phone, MessageSquare, MapPin, Printer, X, Home, Check, Settings, Globe, AlertCircle, Menu, Bell, ExternalLink, User, Calendar, Save, GraduationCap, Info, FolderOpen, UserCheck } from 'lucide-react';
import styles from './dashboard.module.css';
import { RefreshButton } from '@/components/RefreshButton';
import { Header } from '@/components/Header';
import { FamilyDashboardFilters, FamilyExpandedDetails, FamilyPrintUtils, AnnouncementManager, useFooterAnnouncements, getAnnouncementBadgeVariant } from '@/components/dashboard';
import type { AnnouncementWithStaff } from '@/components/dashboard';

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


export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, logout, updateUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultDateRange = getDefaultDateRange();

  // Load filters from localStorage or use defaults
  const loadFiltersFromStorage = (): SearchFilters => {
    try {
      const savedFilters = localStorage.getItem('familyDashboardFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        // Validate the structure
        if (parsed && typeof parsed.departmentId === 'string' && Array.isArray(parsed.teamIds)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load filters from localStorage:', error);
    }
    return {
      departmentId: '',
      teamIds: []
    };
  };

  const [filters, setFilters] = useState<SearchFilters>(loadFiltersFromStorage());

  // Initialize hasSearched based on whether we have saved filters
  const [hasSearched, setHasSearched] = useState(() => {
    const savedFilters = loadFiltersFromStorage();
    return !!savedFilters.departmentId; // Search if we have a saved department
  });

  // Fetch teams for family queries
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/teams');
      return response.json();
    },
  });

  // Show filters by default when no filters are applied
  const [showFilters, setShowFilters] = useState(() => !filters.departmentId);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [magnifiedImage, setMagnifiedImage] = useState<{ src: string; alt: string } | null>(null);
  const [showFamilyNotesProtectionModal, setShowFamilyNotesProtectionModal] = useState(false);
  const [hasAgreedToFamilyNotesProtection, setHasAgreedToFamilyNotesProtection] = useState(false);
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
  const [nameFilter, setNameFilter] = useState('');

  const { data: families = [], isLoading } = useQuery<FamilyWithMembers[]>({
    queryKey: ['families', filters, teams],
    queryFn: async () => {
      console.log('Family query running with:', { filters, teamsCount: teams.length });
      
      // If specific teams are selected, fetch families for each team and combine (OR condition)
      if (filters.teamIds && filters.teamIds.length > 0) {
        const familyPromises = filters.teamIds.map(async (teamId) => {
          const queryParams = new URLSearchParams();
          queryParams.append('teamId', teamId);
          queryParams.append('sortBy', 'visitedDate');
          queryParams.append('sortOrder', 'desc');
          
          const url = `/api/families?${queryParams.toString()}`;
          const response = await apiRequest('GET', url);
          return response.json();
        });
        
        const familyArrays = await Promise.all(familyPromises);
        const allFamilies = familyArrays.flat();
        
        // Remove duplicates by family ID (in case a family appears in multiple teams)
        const uniqueFamilies = allFamilies.filter((family, index, arr) => 
          arr.findIndex(f => f.id === family.id) === index
        );
        
        // Sort by visitedDate descending (most recent first)
        uniqueFamilies.sort((a, b) => {
          const dateA = new Date(a.visitedDate || '1900-01-01').getTime();
          const dateB = new Date(b.visitedDate || '1900-01-01').getTime();
          return dateB - dateA; // descending order
        });
        
        return uniqueFamilies;
      } else {
        // If no specific teams selected, get all teams in the department and fetch all their families
        // Filter teams by department directly in the query
        const availableTeams = teams.filter(team => team.departmentId === filters.departmentId);
        console.log('Available teams for department:', { departmentId: filters.departmentId, availableTeams });
        
        if (availableTeams.length === 0) {
          console.log('No teams found in department');
          return []; // No teams in this department
        }
        
        const familyPromises = availableTeams.map(async (team) => {
          const queryParams = new URLSearchParams();
          queryParams.append('teamId', team.id);
          queryParams.append('sortBy', 'visitedDate');
          queryParams.append('sortOrder', 'desc');
          
          const url = `/api/families?${queryParams.toString()}`;
          const response = await apiRequest('GET', url);
          return response.json();
        });
        
        const familyArrays = await Promise.all(familyPromises);
        const allFamilies = familyArrays.flat();
        
        // Remove duplicates by family ID
        const uniqueFamilies = allFamilies.filter((family, index, arr) => 
          arr.findIndex(f => f.id === family.id) === index
        );
        
        // Sort by visitedDate descending (most recent first)
        uniqueFamilies.sort((a, b) => {
          const dateA = new Date(a.visitedDate || '1900-01-01').getTime();
          const dateB = new Date(b.visitedDate || '1900-01-01').getTime();
          return dateB - dateA; // descending order
        });
        
        return uniqueFamilies;
      }
    },
    enabled: hasSearched && !!filters.departmentId && teams.length > 0, // Only run if department is selected and teams data is loaded
  });

  // Query for footer announcements
  const { data: footerAnnouncements = [] } = useFooterAnnouncements();

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

  // Save filters to localStorage whenever they change
  const saveFiltersToStorage = (newFilters: SearchFilters) => {
    try {
      localStorage.setItem('familyDashboardFilters', JSON.stringify(newFilters));
    } catch (error) {
      console.warn('Failed to save filters to localStorage:', error);
    }
  };

  // Enhanced setFilters that also saves to localStorage
  const updateFilters = (newFilters: SearchFilters | ((prev: SearchFilters) => SearchFilters)) => {
    if (typeof newFilters === 'function') {
      setFilters(prev => {
        const updated = newFilters(prev);
        saveFiltersToStorage(updated);
        return updated;
      });
    } else {
      setFilters(newFilters);
      saveFiltersToStorage(newFilters);
    }
  };

  const clearFilters = () => {
    const clearedFilters = {
      departmentId: '',
      teamIds: []
    };
    setFilters(clearedFilters);
    saveFiltersToStorage(clearedFilters);
    setHasSearched(false); // Reset search state
    setShowFilters(true); // Show filters again when cleared
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
  const getStatusDisplayLabel = (status: string) => {
    const option = MEMBER_STATUS_OPTIONS.find(opt => opt.value === status);
    return option ? option.label : status;
  };
  const getStatusBorderClassName = (status: string) => {
    switch (status) {
      case 'member': return 'border-blue-200';
      case 'visit': return 'border-green-200';
      case 'pending': return 'border-gray-300';
      default: return 'border-primary/20';
    }
  };


  // Group families by team for display
  const getGroupedFamilies = () => {
    if (!families || families.length === 0) return [];

    // Apply name filter first
    const filteredFamilies = nameFilter.trim()
      ? families.filter(family =>
          family.familyName.toLowerCase().includes(nameFilter.toLowerCase())
        )
      : families;

    // If showing all teams in department or multiple teams, group by team
    const shouldGroupByTeam = filters.teamIds.length === 0 || filters.teamIds.length > 1;

    if (!shouldGroupByTeam) {
      return [{ teamName: null, teamId: null, families: filteredFamilies }];
    }
    
    // Group families by their teamId
    const groupedMap = new Map<string, { team: any; families: any[] }>();

    filteredFamilies.forEach(family => {
      if (family.teamId) {
        const team = teams.find(t => t.id === family.teamId);
        const teamId = family.teamId;
        
        if (!groupedMap.has(teamId)) {
          groupedMap.set(teamId, {
            team: team || { id: teamId, name: 'Unknown Team' },
            families: []
          });
        }
        
        groupedMap.get(teamId)!.families.push(family);
      }
    });
    
    // Convert to array and sort by team name
    return Array.from(groupedMap.values())
      .sort((a, b) => a.team.name.localeCompare(b.team.name))
      .map(group => ({
        teamName: group.team.name,
        teamId: group.team.id,
        families: group.families.sort((a, b) => {
          const dateA = new Date(a.visitedDate || '1900-01-01').getTime();
          const dateB = new Date(b.visitedDate || '1900-01-01').getTime();
          return dateB - dateA; // descending order
        })
      }));
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

  // Hook to get care logs data for each family
  const useCareLogsData = (familyId: string) => {
    return useQuery({
      queryKey: ['care-logs-data', familyId],
      queryFn: async () => {
        const res = await apiRequest('GET', `/api/families/${familyId}/care-logs`);
        const careLogs = await res.json();
        return careLogs;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Component to display support team badge with care log count and animation for recent logs
  const SupportTeamBadgeWithCareLog = ({ familyId, supportTeamMember }: { familyId: string; supportTeamMember?: string }) => {
    const { data: careLogs = [] } = useCareLogsData(familyId);

    // Check if there are any care logs from the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const hasRecentLogs = careLogs.some((log: any) => {
      const logDate = new Date(log.createdAt || log.date);
      return logDate >= oneWeekAgo;
    });

    const careLogCount = careLogs.length;

    // Don't show anything if no support team member and no care logs
    // if (!supportTeamMember && careLogCount === 0) {
    //   return null;
    // }

    return (
      <div className="relative">
        <Badge 
          variant="outline" 
          className={styles.supportTeamBadge}
        >
          {supportTeamMember || '미지정'}
        </Badge>
        {careLogCount > 0 && (
          <div className={`absolute -top-1 -right-1 h-4 w-4 border border-orange-200 text-orange-700 text-xs rounded-full flex items-center justify-center font-medium bg-white ${hasRecentLogs ? styles.careLogBadgeAlarm : ''}`}>
            {careLogCount > 9 ? '9+' : careLogCount}
          </div>
        )}
      </div>
    );
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
            <div class="search-info">Applied Filters: Department and Team filters applied</div>
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


  return (
    <div className={styles.container}>
      <Header
        footerAnnouncements={footerAnnouncements}
        onRefresh={() => setExpandedFamilies(new Set())}
        showAnnouncementDropdown={showAnnouncementDropdown}
        onAnnouncementDropdownChange={setShowAnnouncementDropdown}
      />

      {/* Announcement Manager */}
      <AnnouncementManager />

      {/* Main Content */}
      <div className={styles.main}>
        {/* Search Section */}
        <FamilyDashboardFilters
          filters={filters}
          onFiltersChange={updateFilters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onSearch={() => setHasSearched(true)}
          onClearFilters={clearFilters}
          hasSearched={hasSearched}
        />

        {/* Results Section */}
        <Card className={styles.resultsCard}>
          {hasSearched && (
            <CardHeader className="border-b bg-gray-50/50 p-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="이름 검색"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="flex-1 h-9"
                />
                {nameFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNameFilter('')}
                    className="h-9 px-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
          )}

          {!hasSearched ? (
            <CardContent className={styles.emptyState}>
              <div className={styles.emptyContent}>
                <Search className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a department to get started</h3>
                <p className="text-muted-foreground">Choose a department first, then optionally select specific teams to filter families.</p>
              </div>
            </CardContent>
          ) : isLoading ? (
            <CardContent className={styles.loadingState}>
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-center text-muted-foreground">Searching families...</p>
            </CardContent>
          ) : getGroupedFamilies().length === 0 || getGroupedFamilies().every(group => group.families.length === 0) ? (
            <CardContent className={styles.emptyState}>
              <div className={styles.emptyContent}>
                <Users className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {nameFilter.trim() ? 'No families found matching your search' : 'No families found in selected filters'}
                </h3>
                <p className="text-muted-foreground">
                  {nameFilter.trim()
                    ? `No families found with names containing "${nameFilter}". Try a different search term.`
                    : filters.teamIds.length > 0
                      ? 'No families found in the selected teams. Try selecting different teams or clear team selection to see all families in the department.'
                      : 'No families found in this department.'
                  }
                </p>
              </div>
            </CardContent>
          ) : (
            <div className={styles.familyList}>
              {getGroupedFamilies().map((group, groupIndex) => (
                <div key={group.teamId || `group-${groupIndex}`}>
                  {/* Team Header - only show if grouped by team */}
                  {group.teamName && (
                    <div className="mb-4 mt-6 first:mt-0">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px bg-border flex-1"></div>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-medium px-3 py-1">
                          {group.teamName} ({group.families.length})
                        </Badge>
                        <div className="h-px bg-border flex-1"></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Families in this group */}
                  {group.families.map((family) => (
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
       
                            </Badge>
                              <SupportTeamBadgeWithCareLog 
                                familyId={family.id} 
                                supportTeamMember={group.teamName} 
                              />
                              
                              {!expandedFamilies.has(family.id) && getChildGrades(family) && (
                                <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200">
                                  {getChildGrades(family)}
                                </Badge>
                              )}

                              {!expandedFamilies.has(family.id) && getCourseCount(family) > 0 && (
                                <div className="relative">
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    <GraduationCap className="w-3 h-3" />
                                  </Badge>
                                  <div className="absolute -top-1 -right-1 h-4 w-4 border border-blue-200 text-blue-700 text-xs rounded-full flex items-center justify-center font-medium bg-white">
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
                      <FamilyExpandedDetails
                        family={family}
                        onClose={() => toggleFamilyExpanded(family.id)}
                        onImageClick={(src, alt) => setMagnifiedImage({ src, alt })}
                        expandedGradeGroups={expandedGradeGroups}
                        onToggleGradeGroup={toggleGradeGroup}
                        getStatusBorderClassName={getStatusBorderClassName}
                        getPrimaryCourses={getPrimaryCourses}
                        useCareLogsData={useCareLogsData}
                      />
                    )}
                  </div>
                </div>
                  ))}
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
