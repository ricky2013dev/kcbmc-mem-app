import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { Users, UserCheck, ChevronDown, ChevronUp, Move, Home, User, ArrowUp, ArrowDown } from "lucide-react";
import { useLocation } from "wouter";
import type { FamilyWithMembers, Department, Team } from '@server/schema';
import { Header } from '@/components/Header';

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
  familyPicture?: string | null;
  displayOrder?: number | null;
  members: Array<{
    id: string;
    relationship: string;
    koreanName: string;
    englishName: string;
    displayOrder?: number | null;
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

  // Mutation to update family order within team
  const updateFamilyOrderMutation = useMutation({
    mutationFn: async ({ teamId, familyOrders }: { teamId: string; familyOrders: Array<{ id: string; displayOrder: number }> }) => {
      const response = await apiRequest('PUT', `/api/teams/${teamId}/families/order`, {
        familyOrders
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments/with-teams-and-families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/unassigned"] });
      toast({
        title: "Success",
        description: "Family order updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update family order",
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

  // Move family up/down within team
  const moveFamily = (teamId: string, familyId: string, direction: 'up' | 'down') => {
    // Find the team and its families
    let targetTeam: TeamWithFamilies | undefined;
    for (const dept of departments) {
      for (const team of dept.teams) {
        if (team.id === teamId) {
          targetTeam = team;
          break;
        }
      }
      if (targetTeam) break;
    }

    if (!targetTeam) return;

    // Sort families by display order
    const sortedFamilies = targetTeam.families.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const currentIndex = sortedFamilies.findIndex(f => f.id === familyId);

    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Check bounds
    if (newIndex < 0 || newIndex >= sortedFamilies.length) return;

    // Swap the families
    const reorderedFamilies = [...sortedFamilies];
    [reorderedFamilies[currentIndex], reorderedFamilies[newIndex]] =
    [reorderedFamilies[newIndex], reorderedFamilies[currentIndex]];

    // Update display orders
    const familyOrders = reorderedFamilies.map((family, index) => ({
      id: family.id,
      displayOrder: index + 1
    }));

    updateFamilyOrderMutation.mutate({ teamId, familyOrders });
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

    const activeId = active.id as string;
    const overId = over.id as string;

    // This is family-level dragging
    const familyId = activeId;
    const targetId = overId;

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

  // Loading state
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
    <div className="min-h-screen">
      <Header />

      <div className="container mx-auto p-2 pt-20">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Card View</h1>
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
                                    {teamFamilies.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((family, index) => (
                                      <DraggableFamilyCard
                                        key={family.id}
                                        family={family}
                                        compact
                                        teamId={team.id}
                                        onMoveFamily={moveFamily}
                                        isFirst={index === 0}
                                        isLast={index === teamFamilies.length - 1}
                                      />
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
    </div>
  );
}

// Draggable Family Card Component with Family Reordering
function DraggableFamilyCard({
  family,
  compact = false,
  teamId,
  onMoveFamily,
  isFirst = false,
  isLast = false
}: {
  family: DraggableFamily;
  compact?: boolean;
  teamId?: string;
  onMoveFamily?: (teamId: string, familyId: string, direction: 'up' | 'down') => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
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

  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case 'member': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'visit': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const husband = family.members.find(m => m.relationship === 'husband');
  const wife = family.members.find(m => m.relationship === 'wife');
  const children = family.members.filter(m => m.relationship === 'child');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white border rounded-lg transition-all hover:shadow-md flex items-center
        ${isDragging ? 'opacity-50 shadow-lg' : 'hover:border-blue-300'}
        ${compact ? 'p-2 gap-2' : 'p-4 gap-3'}
      `}
    >
      {/* Drag handle for family assignment between teams */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <Move className={`text-gray-400 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
      </div>

      {/* Family Icon/Picture */}
      <div className={`flex-shrink-0 ${compact ? 'w-6 h-6' : 'w-10 h-10'} bg-primary/10 rounded-full flex items-center justify-center`}>
        {family.familyPicture ? (
          <img
            src={family.familyPicture}
            alt={`${family.familyName} family`}
            className={`${compact ? 'w-6 h-6' : 'w-10 h-10'} object-cover rounded-full`}
          />
        ) : (
          <Users className={`${compact ? 'w-3 h-3' : 'w-5 h-5'} text-primary`} />
        )}
      </div>

      {/* Family Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
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

        {/* Member summary */}
        {!compact && (
          <div className="flex items-center gap-3 mt-1">
            {husband && (
              <span className="text-xs text-blue-600">👤 {husband.koreanName || husband.englishName}</span>
            )}
            {wife && (
              <span className="text-xs text-pink-600">👤 {wife.koreanName || wife.englishName}</span>
            )}
            {children.length > 0 && (
              <span className="text-xs text-green-600">👥 {children.length} 자녀</span>
            )}
          </div>
        )}

        {compact && (
          <span className="text-xs text-gray-500">{family.members.length} members</span>
        )}
      </div>

      {/* Family ordering arrows - only show when in a team */}
      {teamId && onMoveFamily && (
        <div className="flex flex-col gap-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveFamily(teamId, family.id, 'up');
            }}
            disabled={isFirst}
            className={`
              p-1 rounded transition-colors
              ${isFirst
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer'
              }
            `}
            title="Move up"
          >
            <ArrowUp className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveFamily(teamId, family.id, 'down');
            }}
            disabled={isLast}
            className={`
              p-1 rounded transition-colors
              ${isLast
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer'
              }
            `}
            title="Move down"
          >
            <ArrowDown className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          </button>
        </div>
      )}

      {/* Display order indicator for debugging */}
      {family.displayOrder && (
        <span className="text-xs text-gray-400">#{family.displayOrder}</span>
      )}
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