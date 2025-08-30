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
import { Badge } from '@/components/ui/badge';
import { SundayDatePicker } from '@/components/sunday-date-picker';
import { apiRequest } from '@/lib/queryClient';
import { FamilyWithMembers } from '@shared/schema';
import { SearchFilters, MEMBER_STATUS_OPTIONS } from '@/types/family';
import { Users, Search, Plus, Eye, Edit, Trash2, LogOut } from 'lucide-react';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, logout, canAddDelete } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<SearchFilters>({
    name: '',
    lifeGroup: '',
    supportTeamMember: '',
    memberStatus: 'all',
    dateFrom: '',
    dateTo: ''
  });

  const [hasSearched, setHasSearched] = useState(false);

  const { data: families = [], isLoading } = useQuery<FamilyWithMembers[]>({
    queryKey: ['/api/families', filters],
    enabled: hasSearched,
  });

  const deleteMutation = useMutation({
    mutationFn: async (familyId: string) => {
      await apiRequest('DELETE', `/api/families/${familyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families'] });
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
    setFilters({
      name: '',
      lifeGroup: '',
      supportTeamMember: '',
      memberStatus: 'all',
      dateFrom: '',
      dateTo: ''
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
      case 'visit': return 'secondary';
      case 'pending': return 'outline';
      default: return 'secondary';
    }
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
            <h1 className={styles.navTitle}>Family Management</h1>
          </div>
          
          <div className={styles.navRight}>
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
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Search Section */}
        <Card className={styles.searchCard}>
          <CardHeader>
            <h2 className={styles.searchTitle}>Search Families</h2>
          </CardHeader>
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
                <Label htmlFor="dateFrom">Registration Date (From)</Label>
                <SundayDatePicker
                  value={filters.dateFrom}
                  onChange={(value) => setFilters(prev => ({ ...prev, dateFrom: value }))}
                  data-testid="input-date-from"
                />
              </div>
              
              <div>
                <Label htmlFor="dateTo">Registration Date (To)</Label>
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
              
              {canAddDelete && (
                <Button 
                  variant="outline"
                  onClick={() => setLocation('/family/new')}
                  data-testid="button-add-family"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Family
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className={styles.resultsCard}>
          <CardHeader className={styles.resultsHeader}>
            <h3 className={styles.resultsTitle}>Search Results</h3>
            {hasSearched && (
              <p className={styles.resultsCount} data-testid="text-results-count">
                {families.length} families found
              </p>
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
                  <div className={styles.familyContent}>
                    <div className={styles.familyInfo}>
                      <div className={styles.familyAvatar}>
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                      
                      <div className={styles.familyDetails}>
                        <h4 className={styles.familyName} data-testid={`text-family-name-${family.id}`}>
                          {family.familyName}
                        </h4>
                        <div className={styles.familyMeta}>
                          <div><span className="font-medium">Status:</span> <Badge variant={getStatusBadgeVariant(family.memberStatus)}>{family.memberStatus}</Badge></div>
                          <div><span className="font-medium">Phone:</span> {family.phoneNumber}</div>
                          <div><span className="font-medium">Life Group:</span> {family.lifeGroup || 'N/A'}</div>
                          <div><span className="font-medium">Support Team:</span> {family.supportTeamMember || 'N/A'}</div>
                          <div><span className="font-medium">Registration:</span> {family.registrationDate}</div>
                          <div><span className="font-medium">Last Visit:</span> {family.visitedDate}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className={styles.familyActions}>
                      <Button 
                        size="sm"
                        onClick={() => setLocation(`/family/${family.id}/edit`)}
                        data-testid={`button-edit-${family.id}`}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      
                      {canAddDelete && (
                        <Button 
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteFamily(family.id, family.familyName)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${family.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
