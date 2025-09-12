import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { Users, UserCheck, ChevronDown, ChevronUp, Move, Home, User } from "lucide-react";
import { useLocation } from "wouter";
import type { FamilyWithMembers, Department, Team } from '@server/schema';

interface DepartmentWithTeams extends Department {
  teams: TeamWithFamilies[];
}

interface TeamWithFamilies extends Team {
  families: FamilyWithMembers[];
}

interface DraggableFamily {
  id: string;
  familyName: string;
  teamId?: string;
  memberStatus: string;
  familyPicture?: string;
  members: Array<{
    id: string;
    relationship: string;
    koreanName: string;
    englishName: string;
  }>;
}

export default function FamilyTeamDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedFamily, setDraggedFamily] = useState<DraggableFamily | null>(null);

  // Fetch departments with teams and families
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<DepartmentWithTeams[]>({
    queryKey: ["/api/departments/with-teams-and-families"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments');
      const departments = await response.json();
      
      // Fetch teams and families for each department
      const departmentsWithData = await Promise.all(
        departments.map(async (dept: any) => {
          const teamsResponse = await apiRequest('GET', `/api/teams?departmentId=${dept.id}`);
          const teams = await teamsResponse.json();
          
          // Fetch families for each team
          const teamsWithFamilies = await Promise.all(
            teams.map(async (team: any) => {
              const familiesResponse = await apiRequest('GET', `/api/families?teamId=${team.id}`);
              const families = await familiesResponse.json();
              return { ...team, families };
            })
          );
          
          return { ...dept, teams: teamsWithFamilies };
        })
      );
      
      return departmentsWithData;
    },
  });

  // Fetch unassigned families (families without teamId)
  const { data: unassignedFamilies = [] } = useQuery<FamilyWithMembers[]>({
    queryKey: ["/api/families/unassigned"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/families?unassigned=true');
      return response.json();
    },
  });

  // Mutation to update family team assignment
  const updateFamilyTeamMutation = useMutation({
    mutationFn: async ({ familyId, teamId }: { familyId: string; teamId?: string }) => {
      const response = await apiRequest('PUT', `/api/families/${familyId}`, {
        teamId: teamId || null
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments/with-teams-and-families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/unassigned"] });
      toast({
        title: "Success",
        description: "Family assignment updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update family assignment",
        variant: "destructive",
      });
    },
  });

  // Get all families from teams
  const getAllTeamFamilies = (): DraggableFamily[] => {
    const families: DraggableFamily[] = [];
    departments.forEach(dept => {
      dept.teams.forEach(team => {
        team.families.forEach(family => {
          families.push({
            ...family,
            teamId: team.id
          });
        });
      });
    });
    return families;
  };

  // Get unassigned families as draggable
  const getUnassignedDraggableFamilies = (): DraggableFamily[] => {
    return unassignedFamilies.map(family => ({
      ...family,
      teamId: undefined
    }));
  };

  // Get family count for a team
  const getTeamFamilyCount = (teamId: string): number => {
    for (const dept of departments) {
      for (const team of dept.teams) {
        if (team.id === teamId) {
          return team.families.length;
        }
      }
    }
    return 0;
  };

  // Get staff count for a team (from assignedStaff)
  const getTeamStaffCount = (team: Team): number => {
    return team.assignedStaff ? team.assignedStaff.length : 0;
  };

  // Toggle department expansion
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

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // Find the family being dragged
    const allFamilies = [...getAllTeamFamilies(), ...getUnassignedDraggableFamilies()];
    const family = allFamilies.find(f => f.id === active.id);
    if (family) {
      setDraggedFamily(family);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      setDraggedFamily(null);
      return;
    }

    const familyId = active.id as string;
    const targetId = over.id as string;
    
    // Check if dropping on unassigned area
    if (targetId === 'unassigned') {
      updateFamilyTeamMutation.mutate({ familyId });
    } else {
      // Find target team
      let targetTeam: Team | undefined;
      for (const dept of departments) {
        for (const team of dept.teams) {
          if (team.id === targetId) {
            targetTeam = team;
            break;
          }
        }
        if (targetTeam) break;
      }

      if (targetTeam) {
        updateFamilyTeamMutation.mutate({ familyId, teamId: targetTeam.id });
      }
    }

    setActiveId(null);
    setDraggedFamily(null);
  };

  if (departmentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading family dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
        <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLocation('/')}
                className="self-start"
              >
                Back to Home
              </Button>
          <h1 className="text-3xl font-bold">Card View</h1>
        </div>

      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
          {/* Unassigned Families Section */}
          {unassignedFamilies.length > 0 && (
            <Card className="border-dashed border-2 border-gray-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-600">
                  <Users className="w-5 h-5" />
                  Unassigned Families ({unassignedFamilies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DroppableArea id="unassigned">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {getUnassignedDraggableFamilies().map((family) => (
                      <DraggableFamilyCard key={family.id} family={family} />
                    ))}
                  </div>
                </DroppableArea>
              </CardContent>
            </Card>
          )}

          {/* Departments and Teams */}
          {departments.map((department) => (
            <Card key={department.id}>
              <CardHeader>
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleDepartment(department.id)}
                >
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {department.name}
                    <Badge variant="outline">
                      {department.teams.reduce((sum, team) => sum + getTeamStaffCount(team), 0)} staff
                    </Badge>
                    <Badge variant="secondary">
                      {department.teams.reduce((sum, team) => sum + team.families.length, 0)} families
                    </Badge>
                  </CardTitle>
                  {expandedDepartments.has(department.id) ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
                {department.description && (
                  <p className="text-sm text-muted-foreground">{department.description}</p>
                )}
              </CardHeader>
              
              {expandedDepartments.has(department.id) && (
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {department.teams.map((team) => {
                      const teamFamilies = team.families.map(family => ({
                        ...family,
                        teamId: team.id
                      }));
                      
                      return (
                        <Card key={team.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                              <span>{team.name}</span>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {getTeamStaffCount(team)} staff
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {team.families.length} families
                                </Badge>
                              </div>
                            </CardTitle>
                            {team.description && (
                              <p className="text-xs text-muted-foreground">{team.description}</p>
                            )}
                          </CardHeader>
                          <CardContent>
                            <DroppableArea id={team.id}>
                              <div className="min-h-[120px] space-y-3">
                                {teamFamilies.length === 0 ? (
                                  <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                    Drop families here
                                  </div>
                                ) : (
                                  <div className="grid gap-2">
                                    {teamFamilies.map((family) => (
                                      <DraggableFamilyCard key={family.id} family={family} compact />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </DroppableArea>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && draggedFamily ? (
            <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-lg opacity-90">
              <div className="flex items-center gap-2">
                <Move className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{draggedFamily.familyName}</span>
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${
                    draggedFamily.memberStatus === 'member' ? 'bg-blue-100 text-blue-800' : 
                    draggedFamily.memberStatus === 'visit' ? 'bg-green-100 text-green-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {draggedFamily.memberStatus}
                </Badge>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// Draggable Family Card Component
function DraggableFamilyCard({ family, compact = false }: { family: DraggableFamily; compact?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: family.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const husband = family.members.find(m => m.relationship === 'husband');
  const wife = family.members.find(m => m.relationship === 'wife');
  const children = family.members.filter(m => m.relationship === 'child');

  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case 'member': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'visit': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        bg-white border rounded-lg cursor-grab transition-all hover:shadow-md active:cursor-grabbing
        ${isDragging ? 'opacity-50 shadow-lg' : 'hover:border-blue-300'}
        ${compact ? 'p-3' : 'p-4'}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Family Icon/Picture */}
        <div className={`flex-shrink-0 ${compact ? 'w-8 h-8' : 'w-10 h-10'} bg-primary/10 rounded-full flex items-center justify-center`}>
          {family.familyPicture ? (
            <img 
              src={family.familyPicture} 
              alt={`${family.familyName} family`}
              className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} object-cover rounded-full`}
            />
          ) : (
            <Users className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
          )}
        </div>

        {/* Family Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Move className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <h4 className={`font-semibold text-gray-900 truncate ${compact ? 'text-sm' : ''}`}>
              {family.familyName}
            </h4>
            <Badge 
              variant="outline" 
              className={`text-xs flex-shrink-0 ${getStatusBadgeClassName(family.memberStatus)}`}
            >
              {family.memberStatus}
            </Badge>
          </div>
          
          {!compact && (
            <div className="space-y-1">
              {husband && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-blue-600" />
                  <span className="text-xs text-gray-600">
                    {husband.koreanName || husband.englishName} (남편)
                  </span>
                </div>
              )}
              {wife && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-pink-600" />
                  <span className="text-xs text-gray-600">
                    {wife.koreanName || wife.englishName} (아내)
                  </span>
                </div>
              )}
              {children.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-gray-600">
                    자녀 {children.length}명
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Droppable Area Component
function DroppableArea({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        transition-all duration-200 rounded-lg
        ${isOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''}
      `}
    >
      {children}
    </div>
  );
}