import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { Department, Team } from '@server/schema';
import { SearchFilters } from '@/types/family';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import styles from '../../pages/dashboards/dashboard.module.css';

interface FamilyDashboardFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  onSearch: () => void;
  onClearFilters: () => void;
  hasSearched: boolean;
}

export function FamilyDashboardFilters({
  filters,
  onFiltersChange,
  showFilters,
  onToggleFilters,
  onSearch,
  onClearFilters,
  hasSearched
}: FamilyDashboardFiltersProps) {
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

  // Get teams filtered by selected department
  const getAvailableTeams = () => {
    if (!filters.departmentId) return [];
    return teams.filter(team => team.departmentId === filters.departmentId);
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

  const handleDepartmentChange = (value: string) => {
    onFiltersChange({
      ...filters,
      departmentId: value,
      teamIds: [] // Reset teams when department changes
    });
    onSearch();
    // Auto-hide filters after selection for cleaner UI
    onToggleFilters();
  };

  const handleTeamToggle = (teamId: string) => {
    const isSelected = filters.teamIds.includes(teamId);
    onFiltersChange({
      ...filters,
      teamIds: isSelected
        ? filters.teamIds.filter(id => id !== teamId)
        : [...filters.teamIds, teamId]
    });
  };

  return (
    <Card className={styles.searchCard}>
      <CardHeader className={!showFilters ? styles.searchHeaderCompact : ''}>
        <div className={styles.searchHeader}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFilters}
            className={styles.toggleButton}
            data-testid="button-toggle-filters"
          >
            {showFilters ? (
              <>
                <ChevronUp className="w-4 h-2 mr-2 text-blue-600" />
                <span className="text-blue-600">Hide Filters</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-2 mr-2 text-blue-600" />
                <span className="text-blue-600">Search Filters</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {showFilters && (
        <CardContent className={styles.searchContent}>
          {/* Department Filter */}
          <div className="space-y-1">
            <div>
              <Label htmlFor="department">Department</Label>
              <Select
                value={filters.departmentId}
                onValueChange={handleDepartmentChange}
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
                          onClick={() => handleTeamToggle(team.id)}
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
                <Button variant="secondary" onClick={onClearFilters} data-testid="button-clear-filters">
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

      {/* Active Filters Display - only show when filters are hidden */}
      {!showFilters && hasSearched && getActiveFilters().length > 0 && (
        <CardContent className="pt-0 pb-3">
          <div className="flex flex-nowrap gap-1 pt-1 border-t border-border overflow-x-auto">
            <span className="text-xs font-medium text-muted-foreground mr-1 flex-shrink-0"></span>
            {getActiveFilters().map((filter, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0.5 whitespace-nowrap flex-shrink-0">
                <span className="font-medium">{filter.label}:</span>
                <span className="ml-0.5">{filter.value}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}