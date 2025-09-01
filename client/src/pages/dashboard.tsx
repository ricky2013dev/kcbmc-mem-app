import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { SundayDatePicker } from '@/components/sunday-date-picker';
import { apiRequest } from '@/lib/queryClient';
import { FamilyWithMembers } from '@shared/schema';
import { SearchFilters, MEMBER_STATUS_OPTIONS } from '@/types/family';
import { formatDateForInput, getPreviousSunday } from '@/utils/date-utils';
import { Users, Search, Plus, Edit, Trash2, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './dashboard.module.css';

// Helper function to get default date range (recent 3 months, Sunday-only)
function getDefaultDateRange() {
  const today = new Date();
  const threMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
  
  // Get the most recent Sunday from today
  const dateTo = getPreviousSunday(today);
  
  // Get the first Sunday from 3 months ago
  const dateFrom = getPreviousSunday(threMonthsAgo);
  
  return {
    dateFrom: formatDateForInput(dateFrom),
    dateTo: formatDateForInput(dateTo)
  };
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, logout, canAddDelete } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultDateRange = getDefaultDateRange();

  const [filters, setFilters] = useState<SearchFilters>({
    name: '',
    lifeGroup: '',
    supportTeamMember: '',
    memberStatus: 'all',
    dateFrom: defaultDateRange.dateFrom,
    dateTo: defaultDateRange.dateTo
  });

  const [hasSearched, setHasSearched] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [magnifiedImage, setMagnifiedImage] = useState<{ src: string; alt: string } | null>(null);

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
      queryParams.append('sortBy', 'visitedDate');
      queryParams.append('sortOrder', 'desc');
      
      const url = `/api/families?${queryParams.toString()}`;
      const response = await apiRequest('GET', url);
      return response.json();
    },
    enabled: hasSearched,
  });

  const deleteMutation = useMutation({
    mutationFn: async (familyId: string) => {
      await apiRequest('DELETE', `/api/families/${familyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast({
        title: "Success",
        description: "Family deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete family.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    setHasSearched(true);
  };

  const clearFilters = () => {
    const defaultDateRange = getDefaultDateRange();
    setFilters({
      name: '',
      lifeGroup: '',
      supportTeamMember: '',
      memberStatus: 'all',
      dateFrom: defaultDateRange.dateFrom,
      dateTo: defaultDateRange.dateTo
    });
    setHasSearched(false);
  };

  const handleDeleteFamily = async (familyId: string, familyName: string) => {
    if (window.confirm(`Are you sure you want to delete the family "${familyName}"? This action cannot be undone.`)) {
      await deleteMutation.mutateAsync(familyId);
    }
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

  const getChildGrades = (family: FamilyWithMembers) => {
    const children = family.members.filter(member => 
      member.relationship === 'child' && member.gradeLevel
    );
    const grades = children.map(child => child.gradeLevel).filter(Boolean);
    return grades.length > 0 ? grades.join(', ') : null;
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
          
          <div className={styles.navRight}>
            {canAddDelete && (
              <Button 
                variant="default"
                size="sm"
                onClick={() => setLocation('/family/new')}
                data-testid="button-add-family"
                className="mr-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            )}
            <span className={styles.userName} data-testid="text-current-user">
              {user?.fullName} ({user?.group})
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
        </div>
      </nav>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Search Section */}
        <Card className={`${styles.searchCard} ${!showFilters ? styles.searchCardCompact : ''}`}>
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
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Hide Filters
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Search Filters
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className={styles.searchContent}>
            <div className={styles.searchGrid}>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Search by name..."
                  value={filters.name}
                  onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-search-name"
                />
              </div>
              
              <div>
                <Label htmlFor="lifeGroup">Life Group</Label>
                <Input
                  id="lifeGroup"
                  placeholder="Life group..."
                  value={filters.lifeGroup}
                  onChange={(e) => setFilters(prev => ({ ...prev, lifeGroup: e.target.value }))}
                  data-testid="input-search-life-group"
                />
              </div>
              
              <div>
                <Label htmlFor="supportTeam">Support Team</Label>
                <Input
                  id="supportTeam"
                  placeholder="Support team member..."
                  value={filters.supportTeamMember}
                  onChange={(e) => setFilters(prev => ({ ...prev, supportTeamMember: e.target.value }))}
                  data-testid="input-search-support-team"
                />
              </div>
              
              <div>
                <Label htmlFor="status">Member Status</Label>
                <Select value={filters.memberStatus} onValueChange={(value) => setFilters(prev => ({ ...prev, memberStatus: value }))}>
                  <SelectTrigger data-testid="select-search-status">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {MEMBER_STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className={styles.dateGrid}>
              <div>
                <Label htmlFor="dateFrom">Visited Date (From)</Label>
                <SundayDatePicker
                  value={filters.dateFrom}
                  onChange={(value) => setFilters(prev => ({ ...prev, dateFrom: value }))}
                  data-testid="input-date-from"
                />
              </div>
              
              <div>
                <Label htmlFor="dateTo">Visited Date (To)</Label>
                <SundayDatePicker
                  value={filters.dateTo}
                  onChange={(value) => setFilters(prev => ({ ...prev, dateTo: value }))}
                  data-testid="input-date-to"
                />
              </div>
            </div>
            
            <div className={styles.searchActions}>
              <Button onClick={handleSearch} data-testid="button-search">
                <Search className="w-4 h-4 mr-2" />
                Search Families
              </Button>
              
              <Button variant="secondary" onClick={clearFilters} data-testid="button-clear-filters">
                Clear Filters
              </Button>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Results Section */}
        <Card className={styles.resultsCard}>
          <CardHeader className={styles.resultsHeader}>
            <h3 className={styles.resultsTitle}>Search Results {hasSearched && (
              < >
                : {families.length} 
              </>
            )}</h3>
            
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
                    onClick={() => toggleFamilyExpanded(family.id)}
                  >
                    <div className={styles.familyInfo}>
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
                          <h4 className={styles.familyName} data-testid={`text-family-name-${family.id}`}>
                            {family.familyName}
                          </h4>
                          <div className={styles.familyBadges}>
                            <Badge 
                              variant={getStatusBadgeVariant(family.memberStatus)}
                              className={getStatusBadgeClassName(family.memberStatus)}
                            >
                              {getStatusDisplayLabel(family.memberStatus)} - {family.visitedDate}
                            </Badge>
                            {family.supportTeamMember && (
                              <Badge variant="outline" className={styles.supportTeamBadge}>
                                {family.supportTeamMember}
                              </Badge>
                            )}
                            {getChildGrades(family) && (
                              <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200">
                                {getChildGrades(family)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {expandedFamilies.has(family.id) && (
                      <div className={styles.expandedContent}>
                        <div className={styles.familyDetailsExpanded}>
                          {/* Large Family Picture */}
                          {family.familyPicture && (
                            <div className="mb-6 flex justify-center">
                              <img 
                                src={family.familyPicture} 
                                alt={`${family.familyName} family`}
                                className="w-32 h-32 object-cover rounded-lg border-4 border-primary/20 shadow-lg cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMagnifiedImage({
                                    src: family.familyPicture!,
                                    alt: `${family.familyName} family`
                                  });
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          
                          <div className={styles.contactInfo}>
                            {family.supportTeamMember && (
                              <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Support Team:</span>
                                <span>{family.supportTeamMember}</span>
                              </div>
                            )}
                            {family.lifeGroup && (
                              <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Life Group:</span>
                                <span>{family.lifeGroup}</span>
                              </div>
                            )}
                            {family.phoneNumber && (
                              <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Phone:</span>
                                <span>{family.phoneNumber}</span>
                              </div>
                            )}
                            {(() => {
                              const children = family.members.filter(m => m.relationship === 'child');
                              return children.length > 0 && (
                                <div className={styles.infoItem}>
                                  <span className={styles.infoLabel}>Children:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {children.map((child, index) => (
                                      <div key={child.id || index} className="bg-green-50 border border-green-200 rounded px-2 py-1 text-sm">
                                        <div className="font-medium">
                                          {child.koreanName && child.englishName 
                                            ? `${child.koreanName} (${child.englishName})`
                                            : child.koreanName || child.englishName
                                          }
                                        </div>
                                        {child.gradeLevel && (
                                          <span className="text-green-700">
                                            {child.gradeLevel}
                                            {child.gradeGroup && ` (${child.gradeGroup})`}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                            {(() => {
                              const husband = family.members.find(m => m.relationship === 'husband');
                              return husband?.courses && husband.courses.length > 0 && (
                                <div className={styles.infoItem}>
                                  <span className={styles.infoLabel}>Husband Courses:</span>
                                  <span>{husband.courses.join(', ')}</span>
                                </div>
                              );
                            })()}
                            {(() => {
                              const wife = family.members.find(m => m.relationship === 'wife');
                              return wife?.courses && wife.courses.length > 0 && (
                                <div className={styles.infoItem}>
                                  <span className={styles.infoLabel}>Wife Courses:</span>
                                  <span>{wife.courses.join(', ')}</span>
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
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            {canAddDelete && (
                              <Button 
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFamily(family.id, family.familyName);
                                }}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${family.id}`}
                                className={styles.deleteButton}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
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
        <DialogContent className="max-w-4xl p-4">
          {magnifiedImage && (
            <div className="flex justify-center">
              <img 
                src={magnifiedImage.src} 
                alt={magnifiedImage.alt}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
