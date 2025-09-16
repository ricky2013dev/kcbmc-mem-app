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
import { SearchFilters, COURSE_OPTIONS } from '@/types/family';
import { formatDateForInput, getPreviousSunday } from '@/utils/date-utils';
import { getGradeGroupFirstChar } from '@/utils/grade-utils';
import { Users, Search, Plus, Edit, Copy, LogOut, ChevronDown, ChevronUp, Phone, MessageSquare, MapPin, Printer, X, Home, Check, Settings, Globe, AlertCircle, Menu, Bell, ExternalLink, User, Calendar, Save, GraduationCap, Info, FolderOpen, UserCheck } from 'lucide-react';
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

  // Fetch departments
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments');
      return response.json();
    },
  });

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/teams');
      return response.json();
    },
  });

  // Validate saved filters when departments and teams are loaded
  useEffect(() => {
    if (departments.length > 0 && teams.length > 0) {
      const isValidDepartment = !filters.departmentId || departments.some(dept => dept.id === filters.departmentId);
      const availableTeams = getAvailableTeams();
      const validTeamIds = filters.teamIds.filter(teamId => availableTeams.some(team => team.id === teamId));
      
      // If department is invalid or some teams are invalid, update filters
      if (!isValidDepartment || validTeamIds.length !== filters.teamIds.length) {
        const updatedFilters = {
          departmentId: isValidDepartment ? filters.departmentId : '',
          teamIds: validTeamIds
        };
        setFilters(updatedFilters);
        saveFiltersToStorage(updatedFilters);
        if (!updatedFilters.departmentId) {
          setHasSearched(false);
        }
        
        // Show toast only if filters were cleaned up due to invalid data
        if (!isValidDepartment || validTeamIds.length !== filters.teamIds.length) {
          toast({
            title: "Filters updated",
            description: "Some saved filters were no longer valid and have been updated.",
          });
        }
      }
    }
  }, [departments, teams]); // Only run when departments or teams data changes
  // Show filters by default when no filters are applied
  const [showFilters, setShowFilters] = useState(() => !filters.departmentId);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [magnifiedImage, setMagnifiedImage] = useState<{ src: string; alt: string } | null>(null);
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
  const getStatusBorderClassName = (status: string) => {
    switch (status) {
      case 'member': return 'border-blue-200';
      case 'visit': return 'border-green-200';
      case 'pending': return 'border-gray-300';
      default: return 'border-primary/20';
    }
  };

  const getActiveFilters = () => {
    const activeFilters = [];
    
    if (filters.departmentId && departments && Array.isArray(departments)) {
      const department = departments.find(dept => dept.id === filters.departmentId);
      activeFilters.push({ label: 'Department', value: department?.name || filters.departmentId });
    }
    if (filters.teamIds && filters.teamIds.length > 0 && teams && Array.isArray(teams)) {
      const selectedTeams = teams.filter(team => filters.teamIds.includes(team.id));
      selectedTeams.forEach(team => {
        activeFilters.push({ label: 'Team', value: team.name });
      });
    }
    
    return activeFilters;
  };

  // Get teams filtered by selected department
  const getAvailableTeams = () => {
    if (!filters.departmentId) return [];
    return teams.filter(team => team.departmentId === filters.departmentId);
  };

  // Toggle team selection
  const toggleTeamSelection = (teamId: string) => {
    updateFilters(prev => ({
      ...prev,
      teamIds: prev.teamIds.includes(teamId)
        ? prev.teamIds.filter(id => id !== teamId)
        : [...prev.teamIds, teamId]
    }));
  };

  // Group families by team for display
  const getGroupedFamilies = () => {
    if (!families || families.length === 0) return [];
    
    // If showing all teams in department or multiple teams, group by team
    const shouldGroupByTeam = filters.teamIds.length === 0 || filters.teamIds.length > 1;
    
    if (!shouldGroupByTeam) {
      return [{ teamName: null, teamId: null, families }];
    }
    
    // Group families by their teamId
    const groupedMap = new Map<string, { team: any; families: any[] }>();
    
    families.forEach(family => {
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
    if (!supportTeamMember && careLogCount === 0) {
      return null;
    }

    return (
      <div className="relative">
        <Badge 
          variant="outline" 
          className={styles.supportTeamBadge}
        >
          {supportTeamMember || 'Supporter'}
        </Badge>
        {careLogCount > 0 && (
          <div className={`absolute -top-1 -right-1 h-4 w-4 border border-orange-200 text-orange-700 text-xs rounded-full flex items-center justify-center font-medium bg-white ${hasRecentLogs ? styles.careLogBadgeAlarm : ''}`}>
            {careLogCount > 9 ? '9+' : careLogCount}
          </div>
        )}
      </div>
    );
  };

  // Component to display care log tab title with count
  const CareLogTabTitle = ({ familyId }: { familyId: string }) => {
    const { data: careLogs = [] } = useCareLogsData(familyId);
    const careLogCount = careLogs.length;

    return (
      <div className="flex items-center gap-2">
        <span>로그</span>
        {careLogCount > 0 && (
          <span className="inline-flex items-center justify-center h-5 w-5 text-xs font-medium text-orange-700 bg-orange-100 border border-orange-200 rounded-full">
            {careLogCount > 9 ? '9+' : careLogCount}
          </span>
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
              <img
                src="/kcmbc-logo.svg"
                alt="KCMBC Logo"
                className="w-5 h-5"
              />
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
     
            {/* Desktop Menu - Hidden on Mobile */}
            <div className="hidden md:flex items-center space-x-4">
              {user?.group === 'ADM' && (
                <div className="flex space-x-2">
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={() => setLocation('/departments')}
                    data-testid="button-departments"
                    className="text-orange-700 hover:text-primary-foreground/80"
                    title="Department Management"
                  >
                    <FolderOpen className="w-4 h-4" /> 지회(트리뷰)
                  </Button>
 
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={() => setLocation('/family-dashboard')}
                    data-testid="button-family-dashboard"
                    className="text-cyan-700 hover:text-primary-foreground/80"
                    title="Family Team Dashboard"
                  >
                    <Users className="w-4 h-4" /> 지회(카드뷰)
                  </Button>
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
                      <DropdownMenuItem onClick={() => setLocation('/departments')}>
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Departments 
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation('/teams')}>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Teams 
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation('/family-dashboard')}>
                        <Users className="w-4 h-4 mr-2" />
                        Family Teams 
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
              {/* Department Filter */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={filters.departmentId}
                    onValueChange={(value) => {
                      updateFilters(prev => ({ 
                        ...prev, 
                        departmentId: value,
                        teamIds: [] // Reset teams when department changes
                      }));
                      setHasSearched(true);
                      // Auto-hide filters after selection for cleaner UI
                      setShowFilters(false);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department first..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Team Filter - Only show if department is selected */}
                {filters.departmentId && (
                  <div>
                    <Label>Teams (select multiple)</Label>
                    <div className="flex flex-wrap gap-2 mt-2 min-h-[2.5rem] p-3 border border-input bg-background rounded-md">
                      {getAvailableTeams().length === 0 ? (
                        <span className="text-muted-foreground text-sm">No teams available in this department</span>
                      ) : (
                        getAvailableTeams().map((team) => {
                          const isSelected = filters.teamIds.includes(team.id);
                          return (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => {
                                updateFilters(prev => ({
                                  ...prev,
                                  teamIds: isSelected 
                                    ? prev.teamIds.filter(id => id !== team.id)
                                    : [...prev.teamIds, team.id]
                                }));
                              }}
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                                isSelected 
                                  ? 'bg-primary text-primary-foreground border-primary' 
                                  : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
                              }`}
                            >
                              {team.name}
                              {isSelected && (
                                <X className="w-3 h-3 ml-1" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {filters.departmentId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {filters.teamIds.length === 0 
                          ? `Showing all families from all teams in this department` 
                          : `${filters.teamIds.length} team(s) selected`}
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Filter Actions */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-2">
                  {filters.departmentId && (
                    <Button variant="secondary" onClick={clearFilters} data-testid="button-clear-filters">
                      Clear All Filters
                    </Button>
                  )}
                </div>
                {filters.departmentId && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Filters saved</span>
                  </div>
                )}
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
                <h3 className="text-lg font-semibold mb-2">Select a department to get started</h3>
                <p className="text-muted-foreground">Choose a department first, then optionally select specific teams to filter families.</p>
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
                <h3 className="text-lg font-semibold mb-2">No families found in selected filters</h3>
                <p className="text-muted-foreground">
                  {filters.teamIds.length > 0 
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

                              <SupportTeamBadgeWithCareLog 
                                familyId={family.id} 
                                supportTeamMember={family.supportTeamMember || undefined} 
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
                      <div className={styles.expandedContent}>
                        <Tabs defaultValue="current-info" className="w-full">
                          <div className="grid grid-cols-3 gap-2 w-full items-center">
                            <TabsList className="grid grid-cols-2 col-span-2">
                              <TabsTrigger value="current-info">가족사항</TabsTrigger>
                              <TabsTrigger value="care-logs">
                                <CareLogTabTitle familyId={family.id} />
                              </TabsTrigger>
                            </TabsList>

                            <div className="flex justify-center">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/family/${family.id}/edit`);
                                }}
                                data-testid={`button-edit-${family.id}`}
                                className="px-4 py-1 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-sm"
                                title="Edit family"
                              >
                                <Edit className="w-4 h-4" />Edit
                              </Button>
                            </div>
                          </div>
                          
                          <TabsContent value="current-info" className="mt-4">
                            <div className={styles.familyDetailsExpanded}>
                              {/* Large Family Picture */}
                              <div className="mb-6 flex justify-center">
                                <div className="relative">
                                  {family.familyPicture ? (
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
                                          const fallback = target.parentElement?.parentElement?.querySelector('.expanded-fallback-icon') as HTMLElement;
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                      <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1.5 hover:bg-opacity-70 transition-all">
                                        <Search className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`w-32 h-32 rounded-lg border-4 ${getStatusBorderClassName(family.memberStatus)} shadow-lg bg-gray-100 flex items-center justify-center`}>
                                      <Users className="w-16 h-16 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="expanded-fallback-icon hidden w-32 h-32 rounded-lg border-4 border-gray-300 shadow-lg bg-gray-100 items-center justify-center">
                                    <Users className="w-16 h-16 text-muted-foreground" />
                                  </div>
                                </div>
                              </div>
                              
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
                                    family.state,
                                    family.zipCode
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
                          
                          <div className="flex justify-between items-center mt-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(fullAddress);
                                toast({
                                  description: "Address copied to clipboard",
                                });
                              }}
                              className="text-primary hover:text-primary/80"
                              title="Copy address"
                            >
                              <Copy className="w-4 h-4" />Copy Address
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
                                                   {`${getGradeGroupFirstChar(child.gradeLevel) || (index + 1)}${child.gradeLevel}`}
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
