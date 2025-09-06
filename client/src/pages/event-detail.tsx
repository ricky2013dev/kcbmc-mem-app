import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { EventWithAttendance, EventAttendanceWithDetails } from '@shared/schema';
import { Calendar, Clock, MapPin, Users, Edit, ArrowLeft, User, UserCheck, UserX, UserMinus, LogOut, Settings, Bell, ChevronDown, ChevronRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RefreshButton } from '@/components/RefreshButton';

interface EventDetailPageProps {
  eventId?: string;
}

export default function EventDetailPage({ eventId: propEventId }: EventDetailPageProps) {
  const params = useParams();
  const eventId = propEventId || params.id;
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [showChildrenBreakdown, setShowChildrenBreakdown] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: [`/api/events/${eventId}`],
    enabled: !!eventId,
  });

  const { data: attendance = [], refetch: refetchAttendance } = useQuery({
    queryKey: [`/api/events/${eventId}/attendance`],
    enabled: !!eventId,
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ attendanceId, status }: { attendanceId: string; status: string }) => {
      return apiRequest('PUT', `/api/attendance/${attendanceId}`, {
        attendanceStatus: status,
        eventId: eventId,
      });
    },
    onSuccess: () => {
      // Force refetch attendance data to update all statistics
      refetchAttendance();
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/attendance`] });
      toast({
        title: 'Success',
        description: 'Attendance updated successfully',
      });
    },
    onError: (error) => {
      console.error('Update attendance error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update attendance',
        variant: 'destructive',
      });
    },
  });

  const handleAttendanceUpdate = (attendanceId: string, status: string) => {
    updateAttendanceMutation.mutate({ attendanceId, status });
  };

  const getAttendanceStats = () => {
    const stats = {
      present: 0,
      absent: 0,
      pending: 0,
      totalMembers: 0,
      parentCount: 0,
      childCount: 0,
      presentParentCount: 0,
      presentChildCount: 0,
      youth: 0,
      youthMiddle: 0,
      youthHigh: 0,
      teamKid: 0,
      dreamKid: 0,
      sprouts: 0,
      college: 0,
      presentYouth: 0,
      presentTeamKid: 0,
      presentDreamKid: 0,
      presentSprouts: 0,
      presentCollege: 0,
      familyCount: 0,
      presentFamilyCount: 0,
    };

    const uniqueFamilies = new Set();
    const presentFamilies = new Set();

    // Filter out records for members without names
    const validAttendance = attendance.filter((record) => {
      if (!record.familyMember) {
        // Keep family-level records
        return true;
      }
      
      // Only include members with names
      const hasKoreanName = record.familyMember.koreanName && record.familyMember.koreanName.trim() !== '';
      const hasEnglishName = record.familyMember.englishName && record.familyMember.englishName.trim() !== '';
      return hasKoreanName || hasEnglishName;
    });

    validAttendance.forEach((record) => {
      stats.totalMembers++;
      uniqueFamilies.add(record.family.id);

      if (record.attendanceStatus === 'present') {
        stats.present++;
        presentFamilies.add(record.family.id);
      } else if (record.attendanceStatus === 'absent') {
        stats.absent++;
      } else {
        stats.pending++;
      }

      // Count family members by grade groups
      if (record.familyMember) {
        const gradeGroup = record.familyMember.gradeGroup;
        const isPresent = record.attendanceStatus === 'present';
        
        if (gradeGroup === 'Youth(Middle)') {
          stats.youthMiddle++;
          stats.youth++;
          if (isPresent) stats.presentYouth++;
        } else if (gradeGroup === 'Youth(High)') {
          stats.youthHigh++;
          stats.youth++;
          if (isPresent) stats.presentYouth++;
        } else if (gradeGroup === 'Team Kid') {
          stats.teamKid++;
          if (isPresent) stats.presentTeamKid++;
        } else if (gradeGroup === 'Dream Kid') {
          stats.dreamKid++;
          if (isPresent) stats.presentDreamKid++;
        } else if (gradeGroup === 'Sprouts') {
          stats.sprouts++;
          if (isPresent) stats.presentSprouts++;
        } else if (gradeGroup === 'College/Young Adult') {
          stats.college++;
          if (isPresent) stats.presentCollege++;
        } else {
          stats.parentCount++; // Adults/parents
          if (isPresent) stats.presentParentCount++;
        }
      } else {
        // If no specific member, count as parent/family unit
        stats.parentCount++;
        if (record.attendanceStatus === 'present') stats.presentParentCount++;
      }
    });

    stats.childCount = stats.youth + stats.teamKid + stats.dreamKid + stats.sprouts + stats.college;
    stats.presentChildCount = stats.presentYouth + stats.presentTeamKid + stats.presentDreamKid + stats.presentSprouts + stats.presentCollege;
    stats.familyCount = uniqueFamilies.size;
    stats.presentFamilyCount = presentFamilies.size;
    return stats;
  };

  const groupAttendanceByFamily = () => {
    const familyGroups = new Map();

    // Filter out records for members without names
    const validAttendance = attendance.filter((record) => {
      if (!record.familyMember) {
        // Keep family-level records
        return true;
      }
      
      // Only include members with names
      const hasKoreanName = record.familyMember.koreanName && record.familyMember.koreanName.trim() !== '';
      const hasEnglishName = record.familyMember.englishName && record.familyMember.englishName.trim() !== '';
      return hasKoreanName || hasEnglishName;
    });

    validAttendance.forEach((record) => {
      const familyId = record.family.id;
      if (!familyGroups.has(familyId)) {
        familyGroups.set(familyId, {
          family: record.family,
          members: [],
        });
      }
      familyGroups.get(familyId).members.push(record);
    });

    // Sort members within each family
    const sortedFamilyGroups = Array.from(familyGroups.values()).map(familyGroup => ({
      ...familyGroup,
      members: familyGroup.members.sort((a, b) => {
        const aRelationship = a.familyMember?.relationship || '';
        const bRelationship = b.familyMember?.relationship || '';
        
        // Define order: husband, wife, then children by age (oldest first)
        const getOrder = (relationship: string, gradeLevel?: string | null, birthDate?: string | null) => {
          if (relationship === 'husband') return 1;
          if (relationship === 'wife') return 2;
          if (relationship === 'child') {
            // For children, sort by grade level (higher grade = older = comes first)
            if (gradeLevel) {
              const grade = parseInt(gradeLevel);
              return 1000 - grade; // Higher grade gets lower sort value (comes first)
            }
            // If no grade level, use birth date (older = comes first)
            if (birthDate) {
              return new Date(birthDate).getTime();
            }
            return 3000; // Default for children without grade/birth date
          }
          return 4000; // Other relationships go last
        };

        const aOrder = getOrder(aRelationship, a.familyMember?.gradeLevel, a.familyMember?.birthDate);
        const bOrder = getOrder(bRelationship, b.familyMember?.gradeLevel, b.familyMember?.birthDate);
        
        return aOrder - bOrder;
      })
    }));

    return sortedFamilyGroups;
  };

  const toggleFamilyExpansion = (familyId: string) => {
    const newExpanded = new Set(expandedFamilies);
    if (newExpanded.has(familyId)) {
      newExpanded.delete(familyId);
    } else {
      newExpanded.add(familyId);
    }
    setExpandedFamilies(newExpanded);
  };

  const formatMemberName = (koreanName?: string | null, englishName?: string | null) => {
    const korean = koreanName?.trim() || '';
    const english = englishName?.trim() || '';
    
    if (korean && english) {
      return `${korean} (${english})`;
    } else if (korean) {
      return korean;
    } else if (english) {
      return english;
    }
    return 'Unnamed';
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <UserCheck className="h-4 w-4 text-green-600" />;
      case 'absent':
        return <UserX className="h-4 w-4 text-red-600" />;
      default:
        return <UserMinus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">Present</Badge>;
      case 'absent':
        return <Badge variant="destructive">Absent</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isAdmin = user?.group === 'ADM' || user?.group === 'MGM';
  const canEditAttendance = isAdmin  // Only admins and managers can edit attendance

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
          <p className="text-muted-foreground mb-4">The event you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/events')}>Back to Events</Button>
        </div>
      </div>
    );
  }

  const stats = getAttendanceStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/events')}
                className="text-muted-foreground hover:text-foreground p-2 sm:px-3 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Events</span>
              </Button>
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                {event.title}
              </h1>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <RefreshButton onRefresh={() => refetchAttendance()} />

              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/events/${eventId}/edit`)}
                  className="bg-white/50 border-blue-200 hover:bg-blue-50 p-2 sm:px-3"
                >
                  <Edit className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit Event</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2 sm:px-3">
                    <User className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{user?.nickName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white/90 backdrop-blur-md">
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/staff-management')}>
                        <Settings className="h-4 w-4 mr-2" />
                        Staff Management
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/news-management')}>
                        <Bell className="h-4 w-4 mr-2" />
                        News Management
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-8">
          {/* Event Info Card */}
          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Event Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-blue-900 text-sm">{formatEventDate(event.date)}</p>
                    <p className="text-xs text-blue-600">Date</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900 text-sm">{event.time}</p>
                    <p className="text-xs text-green-600">Time</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-red-50 to-red-100 rounded-lg sm:col-span-2 lg:col-span-1">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-red-900 text-sm truncate">{event.location}</p>
                    <p className="text-xs text-red-600">Location</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-50/80 rounded-lg">
                <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                  Created by <span className="font-medium mx-1">{event.createdByStaff.fullName}</span> on{' '}
                  <span className="font-medium ml-1">{new Date(event.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Present Attendance Stats */}
          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl mb-4">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                {/* Families */}
                <div className="flex items-center space-x-2 sm:space-x-3 group">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center relative">
                    <span className="text-white font-bold text-sm sm:text-base">F</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Families
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-orange-600">{stats.presentFamilyCount}</p>
                    <p className="text-xs text-muted-foreground">Families</p>
                  </div>
                </div>

                {/* Separator */}
                <div className="w-px h-12 bg-gray-300 mx-2 sm:mx-4"></div>

                {/* Adults */}
                <div className="flex items-center space-x-2 sm:space-x-3 group">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-xl flex items-center justify-center relative">
                    <span className="text-white font-bold text-sm sm:text-base">A</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Adults
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-indigo-600">{stats.presentParentCount}</p>
                    <p className="text-xs text-muted-foreground">Adults</p>
                  </div>
                </div>

                {/* Separator */}
                <div className="w-px h-12 bg-gray-300 mx-2 sm:mx-4"></div>

                {/* Children */}
                <div 
                  className="flex items-center space-x-2 sm:space-x-3 group cursor-pointer hover:bg-white/20 p-1 rounded-lg transition-all duration-200"
                  onClick={() => setShowChildrenBreakdown(!showChildrenBreakdown)}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center relative">
                    <span className="text-white font-bold text-sm sm:text-base">C</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Children
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-purple-600">{stats.presentChildCount}</p>
                    <p className="text-xs text-muted-foreground">Children</p>
                  </div>
                  <div className="flex items-center ml-1">
                    {showChildrenBreakdown ? (
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Children Breakdown - Only shown when expanded */}
          {showChildrenBreakdown && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4">
              {/* Youth */}
              {stats.presentYouth > 0 && (
                <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl overflow-hidden group">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center relative">
                        <span className="text-white font-bold text-base">Y</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Youth
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.presentYouth}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Youth</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Team Kid */}
              {stats.presentTeamKid > 0 && (
                <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl overflow-hidden group">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center relative">
                        <span className="text-white font-bold text-base">T</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Team Kid
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.presentTeamKid}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Team Kid</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Dream Kid */}
              {stats.presentDreamKid > 0 && (
                <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl overflow-hidden group">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center relative">
                        <span className="text-white font-bold text-base">D</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Dream Kid
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.presentDreamKid}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Dream Kid</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sprouts */}
              {stats.presentSprouts > 0 && (
                <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl overflow-hidden group">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-pink-600 rounded-xl flex items-center justify-center relative">
                        <span className="text-white font-bold text-base">S</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Sprouts
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xl sm:text-2xl font-bold text-pink-600">{stats.presentSprouts}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Sprouts</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* College/Young Adult */}
              {stats.presentCollege > 0 && (
                <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl overflow-hidden group">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center relative">
                        <span className="text-white font-bold text-base">C</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          College/Young Adult
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats.presentCollege}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">College</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Show message if no children are present */}
              {stats.presentChildCount === 0 && (
                <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl overflow-hidden col-span-full">
                  <CardContent className="p-4">
                    <div className="text-center text-muted-foreground italic">
                      No children present
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Attendance Section */}
          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl">


            <CardContent className="p-0">
              <div className="space-y-1">
                {groupAttendanceByFamily().map((familyGroup) => {
                  const isExpanded = expandedFamilies.has(familyGroup.family.id);
                  const familyStats = {
                    present: familyGroup.members.filter((m: EventAttendanceWithDetails) => m.attendanceStatus === 'present').length,
                    absent: familyGroup.members.filter((m: EventAttendanceWithDetails) => m.attendanceStatus === 'absent').length,
                    pending: familyGroup.members.filter((m: EventAttendanceWithDetails) => m.attendanceStatus === 'pending').length,
                    total: familyGroup.members.length,
                  };

                  return (
                    <div key={familyGroup.family.id} className="border-b last:border-b-0">
                      {/* Family Header - Mobile Optimized */}
                      <div 
                        className="flex items-center justify-between p-3 sm:p-4 hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleFamilyExpansion(familyGroup.family.id)}
                      >
                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {isExpanded ? 
                              <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            }
                          </div>
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-base sm:text-lg truncate">{familyGroup.family.familyName}</p>
                            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-muted-foreground">
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{familyStats.total}</span>
                              •
                              <span className="text-green-600 font-medium">{familyStats.present}</span>
                              <span className="text-green-600 text-xs">P</span>
                              •
                              <span className="text-red-600 font-medium">{familyStats.absent}</span>
                              <span className="text-red-600 text-xs">A</span>
                              •
                              <span className="text-gray-600 font-medium">{familyStats.pending}</span>
                              <span className="text-gray-600 text-xs">?</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                          {familyStats.present === familyStats.total && familyStats.total > 0 && (
                            <Badge className="bg-green-100 text-green-800 border-green-300 text-xs px-2 py-1">All Present</Badge>
                          )}
                          {familyStats.absent === familyStats.total && familyStats.total > 0 && (
                            <Badge variant="destructive" className="text-xs px-2 py-1">All Absent</Badge>
                          )}
                        </div>
                      </div>

                      {/* Family Members - Mobile Optimized */}
                      {isExpanded && (
                        <div className="bg-gray-50/50">
                          {familyGroup.members.map((record: EventAttendanceWithDetails) => (
                            <div key={record.id} className="flex items-center justify-between p-2 sm:p-3 pl-8 sm:pl-16 border-t hover:bg-muted/20">
                              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                <div className="flex-shrink-0">
                                  {getStatusIcon(record.attendanceStatus)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm sm:text-base truncate">
                                    {record.familyMember 
                                      ? formatMemberName(record.familyMember.koreanName, record.familyMember.englishName)
                                      : 'Family Unit'
                                    }
                                  </p>
                                  <div className="flex items-center space-x-1 text-xs sm:text-sm text-muted-foreground">
                                    <span>{record.familyMember?.relationship || 'Family'}</span>
                                    {record.familyMember?.gradeGroup && (
                                      <>
                                        <span>•</span>
                                        <span className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-700 text-xs">
                                          {record.familyMember.gradeGroup}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                                <div className="hidden sm:block">
                                  {getStatusBadge(record.attendanceStatus)}
                                </div>
                                
                                {canEditAttendance && (
                                  <div className="flex items-center space-x-1">
                                    <Button
                                      size="sm"
                                      variant={record.attendanceStatus === 'present' ? 'default' : 'outline'}
                                      onClick={() => handleAttendanceUpdate(record.id, 'present')}
                                      className={`px-1.5 py-1 text-xs h-6 w-6 sm:px-2 sm:h-7 sm:w-7 ${record.attendanceStatus === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                    >
                                      ✓
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={record.attendanceStatus === 'absent' ? 'default' : 'outline'}
                                      onClick={() => handleAttendanceUpdate(record.id, 'absent')}
                                      className={`px-1.5 py-1 text-xs h-6 w-6 sm:px-2 sm:h-7 sm:w-7 ${record.attendanceStatus === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                                    >
                                      ✗
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={record.attendanceStatus === 'pending' ? 'default' : 'outline'}
                                      onClick={() => handleAttendanceUpdate(record.id, 'pending')}
                                      className={`px-1.5 py-1 text-xs h-6 w-6 sm:px-2 sm:h-7 sm:w-7 ${record.attendanceStatus === 'pending' ? 'bg-gray-600 hover:bg-gray-700' : ''}`}
                                    >
                                      ?
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}