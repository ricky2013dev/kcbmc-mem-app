import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from '@/lib/queryClient';
import { Users, UserCheck, ChevronDown, ChevronRight, Building, Users2, Home } from "lucide-react";

interface Department {
  id: string;
  name: string;
  description?: string;
  teams: Team[];
}

interface Team {
  id: string;
  departmentId: string;
  name: string;
  description?: string;
  assignedStaff: string[];
  families?: Family[];
}

interface Family {
  id: string;
  familyName: string;
  teamId?: string;
  members?: FamilyMember[];
}

interface FamilyMember {
  id: string;
  koreanName?: string;
  englishName?: string;
  relationship: string;
}

interface OrganizationTreeViewProps {
  className?: string;
  showStaffCount?: boolean;
  showFamilyCount?: boolean;
  onDepartmentClick?: (department: Department) => void;
  onTeamClick?: (team: Team) => void;
  onFamilyClick?: (family: Family) => void;
}

export default function OrganizationTreeView({ 
  className,
  showStaffCount = true,
  showFamilyCount = true,
  onDepartmentClick,
  onTeamClick,
  onFamilyClick
}: OrganizationTreeViewProps) {
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Load saved expansion state from localStorage
  useEffect(() => {
    const savedDepartments = localStorage.getItem('treeView_expandedDepartments');
    const savedTeams = localStorage.getItem('treeView_expandedTeams'); 
    const savedFamilies = localStorage.getItem('treeView_expandedFamilies');
    
    if (savedDepartments) {
      setExpandedDepartments(new Set(JSON.parse(savedDepartments)));
    }
    if (savedTeams) {
      setExpandedTeams(new Set(JSON.parse(savedTeams)));
    }
    if (savedFamilies) {
      setExpandedFamilies(new Set(JSON.parse(savedFamilies)));
    }
  }, []);

  // Save expansion state to localStorage
  useEffect(() => {
    localStorage.setItem('treeView_expandedDepartments', JSON.stringify(Array.from(expandedDepartments)));
  }, [expandedDepartments]);

  useEffect(() => {
    localStorage.setItem('treeView_expandedTeams', JSON.stringify(Array.from(expandedTeams)));
  }, [expandedTeams]);

  useEffect(() => {
    localStorage.setItem('treeView_expandedFamilies', JSON.stringify(Array.from(expandedFamilies)));
  }, [expandedFamilies]);

  // Fetch departments with teams and families
  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments/with-teams-and-families"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments');
      const departments = await response.json();
      
      // Fetch teams for each department
      const departmentsWithTeams = await Promise.all(
        departments.map(async (dept: any) => {
          const teamsResponse = await apiRequest('GET', `/api/teams?departmentId=${dept.id}`);
          const teams = await teamsResponse.json();
          
          // Fetch families for each team
          const teamsWithFamilies = await Promise.all(
            teams.map(async (team: any) => {
              try {
                const familiesResponse = await apiRequest('GET', `/api/families?teamId=${team.id}`);
                const families = await familiesResponse.json();
                
                // Fetch members for each family
                const familiesWithMembers = await Promise.all(
                  families.map(async (family: any) => {
                    try {
                      const membersResponse = await apiRequest('GET', `/api/families/${family.id}/members`);
                      const members = await membersResponse.json();
                      return { ...family, members };
                    } catch (error) {
                      console.warn(`Failed to fetch members for family ${family.id}:`, error);
                      return { ...family, members: [] };
                    }
                  })
                );
                
                return { ...team, families: familiesWithMembers };
              } catch (error) {
                console.warn(`Failed to fetch families for team ${team.id}:`, error);
                return { ...team, families: [] };
              }
            })
          );
          
          return { ...dept, teams: teamsWithFamilies };
        })
      );
      
      return departmentsWithTeams;
    },
  });

  // Toggle functions
  const toggleDepartment = (departmentId: string) => {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId);
      } else {
        newSet.add(departmentId);
      }
      return newSet;
    });
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const toggleFamily = (familyId: string) => {
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

  // Handle clicks with optional callbacks
  const handleDepartmentClick = (department: Department) => {
    toggleDepartment(department.id);
    onDepartmentClick?.(department);
  };

  const handleTeamClick = (team: Team) => {
    toggleTeam(team.id);
    onTeamClick?.(team);
  };

  const handleFamilyClick = (family: Family) => {
    toggleFamily(family.id);
    onFamilyClick?.(family);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading organization structure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {departments.map((department) => (
          <div key={department.id} className="space-y-1">
            {/* Department Level */}
            <div
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleDepartmentClick(department)}
            >
              <div className="flex items-center gap-2 flex-1">
                {expandedDepartments.has(department.id) ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <Building className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm">{department.name}</span>
                {showStaffCount && (
                  <Badge variant="secondary" className="text-xs">
                    {department.teams.reduce((sum, team) => sum + team.assignedStaff.length, 0)} staff
                  </Badge>
                )}
                {showFamilyCount && (
                  <Badge variant="outline" className="text-xs">
                    {department.teams.reduce((sum, team) => sum + (team.families?.length || 0), 0)} families
                  </Badge>
                )}
              </div>
            </div>

            {/* Teams Level */}
            {expandedDepartments.has(department.id) && (
              <div className="ml-6 space-y-1">
                {department.teams.map((team) => (
                  <div key={team.id} className="space-y-1">
                    <div
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleTeamClick(team)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {team.families && team.families.length > 0 ? (
                          expandedTeams.has(team.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                        <Users className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{team.name}</span>
                        {showStaffCount && (
                          <Badge variant="secondary" className="text-xs">
                            {team.assignedStaff.length} staff
                          </Badge>
                        )}
                        {showFamilyCount && team.families && (
                          <Badge variant="outline" className="text-xs">
                            {team.families.length} families
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Families Level */}
                    {expandedTeams.has(team.id) && team.families && (
                      <div className="ml-6 space-y-1">
                        {team.families.map((family) => (
                          <div key={family.id} className="space-y-1">
                            <div
                              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/20 cursor-pointer transition-colors"
                              onClick={() => handleFamilyClick(family)}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                {family.members && family.members.length > 0 ? (
                                  expandedFamilies.has(family.id) ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                  )
                                ) : (
                                  <div className="w-4 h-4" />
                                )}
                                <Home className="w-4 h-4 text-purple-600" />
                                <span className="text-sm">{family.familyName}</span>
                                {family.members && (
                                  <Badge variant="outline" className="text-xs">
                                    {family.members.length} members
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Family Members Level */}
                            {expandedFamilies.has(family.id) && family.members && (
                              <div className="ml-6 space-y-1">
                                {family.members.map((member) => (
                                  <div key={member.id} className="flex items-center gap-2 p-1 text-sm text-muted-foreground">
                                    <div className="w-4 h-4" />
                                    <Users2 className="w-3 h-3" />
                                    <span>
                                      {member.koreanName || member.englishName} 
                                      <span className="text-xs ml-1">
                                        ({member.relationship === 'husband' ? '남편' : 
                                          member.relationship === 'wife' ? '아내' : 
                                          member.relationship === 'child' ? '자녀' : member.relationship})
                                      </span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}