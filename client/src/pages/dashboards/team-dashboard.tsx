import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { Users, UserCheck, ChevronDown, ChevronUp, Move } from "lucide-react";
import { useLocation } from "wouter";

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

interface Staff {
  id: string;
  fullName: string;
  nickName: string;
  group: string;
  isActive: boolean;
}

interface Family {
  id: string;
  familyName: string;
  teamId?: string;
}

interface DraggableStaffMember {
  id: string;
  fullName: string;
  nickName: string;
  group: string;
  teamId?: string;
}

export default function TeamDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedStaff, setDraggedStaff] = useState<DraggableStaffMember | null>(null);

  // Fetch departments with teams
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments/with-teams"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments');
      const departments = await response.json();
      
      // Fetch teams for each department
      const departmentsWithTeams = await Promise.all(
        departments.map(async (dept: any) => {
          const teamsResponse = await apiRequest('GET', `/api/teams?departmentId=${dept.id}`);
          const teams = await teamsResponse.json();
          return { ...dept, teams };
        })
      );
      
      return departmentsWithTeams;
    },
  });

  // Fetch all staff members
  const { data: allStaff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/staff');
      return response.json();
    },
  });

  // Fetch families for counting
  const { data: families = [] } = useQuery<Family[]>({
    queryKey: ["/api/families/simple"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/families');
      return response.json();
    },
  });

  // Mutation to update team staff assignments
  const updateTeamStaffMutation = useMutation({
    mutationFn: async ({ teamId, staffIds }: { teamId: string; staffIds: string[] }) => {
      const response = await apiRequest('PUT', `/api/teams/${teamId}`, {
        assignedStaff: staffIds
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments/with-teams"] });
      toast({
        title: "Success",
        description: "Staff assignment updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update staff assignment",
        variant: "destructive",
      });
    },
  });

  // Get staff members assigned to a team
  const getTeamStaff = (team: Team): DraggableStaffMember[] => {
    return allStaff
      .filter(staff => team.assignedStaff.includes(staff.id))
      .map(staff => ({ ...staff, teamId: team.id }));
  };

  // Get unassigned staff members
  const getUnassignedStaff = (): DraggableStaffMember[] => {
    const assignedStaffIds = departments.flatMap(dept => 
      dept.teams.flatMap(team => team.assignedStaff)
    );
    
    return allStaff
      .filter(staff => !assignedStaffIds.includes(staff.id))
      .map(staff => ({ ...staff, teamId: undefined }));
  };

  // Get family count for a team
  const getTeamFamilyCount = (teamId: string): number => {
    return families.filter(family => family.teamId === teamId).length;
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
    
    // Find the staff member being dragged
    const staff = allStaff.find(s => s.id === active.id);
    if (staff) {
      // Find which team they belong to
      let teamId: string | undefined;
      for (const dept of departments) {
        for (const team of dept.teams) {
          if (team.assignedStaff.includes(staff.id)) {
            teamId = team.id;
            break;
          }
        }
        if (teamId) break;
      }
      
      setDraggedStaff({ ...staff, teamId });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      setDraggedStaff(null);
      return;
    }

    const staffId = active.id as string;
    const targetId = over.id as string;
    
    // Find source and target teams
    let sourceTeam: Team | undefined;
    let targetTeam: Team | undefined;
    
    // Check if dropping on a team or unassigned area
    if (targetId === 'unassigned') {
      // Remove from current team
      for (const dept of departments) {
        for (const team of dept.teams) {
          if (team.assignedStaff.includes(staffId)) {
            sourceTeam = team;
            break;
          }
        }
        if (sourceTeam) break;
      }
      
      if (sourceTeam) {
        const newStaffIds = sourceTeam.assignedStaff.filter(id => id !== staffId);
        updateTeamStaffMutation.mutate({ teamId: sourceTeam.id, staffIds: newStaffIds });
      }
    } else {
      // Find target team
      for (const dept of departments) {
        for (const team of dept.teams) {
          if (team.id === targetId) {
            targetTeam = team;
            break;
          }
        }
        if (targetTeam) break;
      }

      // Find source team
      for (const dept of departments) {
        for (const team of dept.teams) {
          if (team.assignedStaff.includes(staffId)) {
            sourceTeam = team;
            break;
          }
        }
        if (sourceTeam) break;
      }

      if (targetTeam) {
        // Remove from source team if exists
        if (sourceTeam && sourceTeam.id !== targetTeam.id) {
          const newSourceStaffIds = sourceTeam.assignedStaff.filter(id => id !== staffId);
          updateTeamStaffMutation.mutate({ teamId: sourceTeam.id, staffIds: newSourceStaffIds });
        }
        
        // Add to target team if not already there
        if (!targetTeam.assignedStaff.includes(staffId)) {
          const newTargetStaffIds = [...targetTeam.assignedStaff, staffId];
          updateTeamStaffMutation.mutate({ teamId: targetTeam.id, staffIds: newTargetStaffIds });
        }
      }
    }

    setActiveId(null);
    setDraggedStaff(null);
  };

  if (departmentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading team dashboard...</p>
        </div>
      </div>
    );
  }

  const unassignedStaff = getUnassignedStaff();

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Team Dashboard</h1>
          <p className="text-muted-foreground mt-2">Drag and drop staff members to assign them to teams</p>
        </div>
        <Button onClick={() => setLocation('/teams')} variant="outline">
          <UserCheck className="w-4 h-4 mr-2" />
          Manage Teams
        </Button>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
          {/* Unassigned Staff Section */}
          {unassignedStaff.length > 0 && (
            <Card className="border-dashed border-2 border-gray-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-600">
                  <Users className="w-5 h-5" />
                  Unassigned Staff ({unassignedStaff.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DroppableArea id="unassigned">
                  <div className="flex flex-wrap gap-2">
                    {unassignedStaff.map((staff) => (
                      <DraggableStaffCard key={staff.id} staff={staff} />
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
                      {department.teams.reduce((sum, team) => sum + team.assignedStaff.length, 0)} staff
                    </Badge>
                    <Badge variant="secondary">
                      {department.teams.length} teams
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
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {department.teams.map((team) => {
                      const teamStaff = getTeamStaff(team);
                      const familyCount = getTeamFamilyCount(team.id);
                      
                      return (
                        <Card key={team.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                              <span>{team.name}</span>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {teamStaff.length} staff
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {familyCount} families
                                </Badge>
                              </div>
                            </CardTitle>
                            {team.description && (
                              <p className="text-xs text-muted-foreground">{team.description}</p>
                            )}
                          </CardHeader>
                          <CardContent>
                            <DroppableArea id={team.id}>
                              <div className="min-h-[80px] space-y-2">
                                {teamStaff.length === 0 ? (
                                  <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                    Drop staff here
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {teamStaff.map((staff) => (
                                      <DraggableStaffCard key={staff.id} staff={staff} />
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
          {activeId && draggedStaff ? (
            <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-lg opacity-90">
              <div className="flex items-center gap-2">
                <Move className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{draggedStaff.fullName}</span>
                <Badge variant="secondary" className="text-xs">
                  {draggedStaff.nickName}
                </Badge>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// Draggable Staff Card Component
function DraggableStaffCard({ staff }: { staff: DraggableStaffMember }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: staff.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab 
        transition-all hover:shadow-md active:cursor-grabbing
        ${isDragging ? 'opacity-50 shadow-lg' : 'hover:border-blue-300'}
        ${staff.group === 'ADM' ? 'bg-red-50 border-red-200 text-red-800' : 
          staff.group === 'MGM' ? 'bg-blue-50 border-blue-200 text-blue-800' :
          'bg-green-50 border-green-200 text-green-800'}
      `}
    >
      <Move className="w-3 h-3" />
      <span className="font-medium text-sm">{staff.fullName}</span>
      <Badge variant="outline" className="text-xs">
        {staff.nickName}
      </Badge>
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

// Required imports for drag and drop
import { useDraggable, useDroppable } from "@dnd-kit/core";