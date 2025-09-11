import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { FamilyImageUploader } from "@/components/FamilyImageUploader";
import { formatPhoneNumber } from "@/utils/phone-format";
import { PlusIcon, PencilIcon, TrashIcon, FolderIcon, UsersIcon, ChevronDownIcon, ChevronRightIcon, UserPlusIcon, HomeIcon, UserIcon, Users2Icon } from "lucide-react";

interface Department {
  id: string;
  name: string;
  description?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  picture?: string;
  teams: Team[];
  createdAt: string;
  updatedAt: string;
}

interface Team {
  id: string;
  departmentId: string;
  name: string;
  description?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  picture?: string;
  assignedStaff: string[];
  createdAt: string;
  updatedAt: string;
}

interface Staff {
  id: string;
  fullName: string;
  nickName: string;
  group: string;
}

interface DepartmentFormData {
  name: string;
  description?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  picture?: string;
}

interface TeamFormData {
  departmentId: string;
  name: string;
  description?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  picture?: string;
  assignedStaff: string[];
}

interface QuickFamilyMemberFormData {
  koreanName: string;
  englishName?: string;
  phoneNumber?: string;
  email?: string;
  memberType: 'husband' | 'wife';
  teamId: string;
  familyPicture?: string;
}

export default function DepartmentTeamManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isQuickFamilyDialogOpen, setIsQuickFamilyDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [departmentFormData, setDepartmentFormData] = useState<DepartmentFormData>({
    name: "",
    description: "",
    contactPersonName: "",
    contactPersonPhone: "",
    contactPersonEmail: "",
    picture: "",
  });
  const [teamFormData, setTeamFormData] = useState<TeamFormData>({
    departmentId: "",
    name: "",
    description: "",
    contactPersonName: "",
    contactPersonPhone: "",
    contactPersonEmail: "",
    picture: "",
    assignedStaff: [],
  });
  const [quickFamilyFormData, setQuickFamilyFormData] = useState<QuickFamilyMemberFormData>({
    koreanName: "",
    englishName: "",
    phoneNumber: "",
    email: "",
    memberType: "husband",
    teamId: "",
    familyPicture: "",
  });

  // Fetch departments
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Fetch teams
  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  // Fetch staff
  const { data: staff = [], isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  // Fetch families with members
  const { data: families = [], isLoading: familiesLoading } = useQuery({
    queryKey: ["/api/families"],
  });

  // Create department mutation
  const createDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create department");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Department created successfully",
      });
      handleCloseDepartmentDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update department mutation
  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DepartmentFormData }) => {
      const response = await fetch(`/api/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update department");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Department updated successfully",
      });
      handleCloseDepartmentDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete department");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Department deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create team");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Team created successfully",
      });
      handleCloseTeamDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TeamFormData }) => {
      const response = await fetch(`/api/teams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update team");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Team updated successfully",
      });
      handleCloseTeamDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/teams/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete team");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Team deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Quick family member creation mutation
  const createQuickFamilyMemberMutation = useMutation({
    mutationFn: async (data: QuickFamilyMemberFormData) => {
      const response = await fetch("/api/families/quick-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create family member");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both families and departments queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Family member created successfully",
      });
      handleCloseQuickFamilyDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDepartmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDepartment) {
      updateDepartmentMutation.mutate({ id: editingDepartment.id, data: departmentFormData });
    } else {
      createDepartmentMutation.mutate(departmentFormData);
    }
  };

  const handleTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeam) {
      updateTeamMutation.mutate({ id: editingTeam.id, data: teamFormData });
    } else {
      createTeamMutation.mutate(teamFormData);
    }
  };

  const handleQuickFamilySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createQuickFamilyMemberMutation.mutate(quickFamilyFormData);
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentFormData({
      name: department.name,
      description: department.description || "",
      contactPersonName: department.contactPersonName || "",
      contactPersonPhone: department.contactPersonPhone || "",
      contactPersonEmail: department.contactPersonEmail || "",
      picture: department.picture || "",
    });
    setIsDepartmentDialogOpen(true);
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamFormData({
      departmentId: team.departmentId,
      name: team.name,
      description: team.description || "",
      contactPersonName: team.contactPersonName || "",
      contactPersonPhone: team.contactPersonPhone || "",
      contactPersonEmail: team.contactPersonEmail || "",
      picture: team.picture || "",
      assignedStaff: team.assignedStaff || [],
    });
    setIsTeamDialogOpen(true);
  };

  const handleCloseDepartmentDialog = () => {
    setIsDepartmentDialogOpen(false);
    setEditingDepartment(null);
    setDepartmentFormData({
      name: "",
      description: "",
      contactPersonName: "",
      contactPersonPhone: "",
      contactPersonEmail: "",
      picture: "",
    });
  };

  const handleCloseTeamDialog = () => {
    setIsTeamDialogOpen(false);
    setEditingTeam(null);
    setTeamFormData({
      departmentId: "",
      name: "",
      description: "",
      contactPersonName: "",
      contactPersonPhone: "",
      contactPersonEmail: "",
      picture: "",
      assignedStaff: [],
    });
  };

  const handleCloseQuickFamilyDialog = () => {
    setIsQuickFamilyDialogOpen(false);
    setQuickFamilyFormData({
      koreanName: "",
      englishName: "",
      phoneNumber: "",
      email: "",
      memberType: "husband",
      teamId: "",
      familyPicture: "",
    });
  };

  const handleDeleteDepartment = (id: string) => {
    deleteDepartmentMutation.mutate(id);
  };

  const handleDeleteTeam = (id: string) => {
    deleteTeamMutation.mutate(id);
  };

  const handleStaffAssignment = (staffId: string, isAssigned: boolean) => {
    setTeamFormData(prev => ({
      ...prev,
      assignedStaff: isAssigned
        ? [...prev.assignedStaff, staffId]
        : prev.assignedStaff.filter(id => id !== staffId)
    }));
  };

  const toggleDepartmentExpansion = (departmentId: string) => {
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

  const toggleTeamExpansion = (teamId: string) => {
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

  const getStaffName = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember ? `${staffMember.fullName} (${staffMember.nickName})` : "Unknown Staff";
  };

  const getDepartmentTeams = (departmentId: string) => {
    return teams.filter(team => team.departmentId === departmentId);
  };

  const getTeamFamilies = (teamId: string) => {
    // Simply filter families by teamId - much cleaner!
    return families.filter(family => family.teamId === teamId);
  };

  const handlePhoneFormat = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setQuickFamilyFormData({ ...quickFamilyFormData, phoneNumber: formatted });
  };

  if (departmentsLoading || teamsLoading || staffLoading || familiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading departments and teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">지회관리</h1>
          <p className="text-muted-foreground mt-2">연합회-지회-팀원</p>
        </div>

        <div className="flex gap-2">
          <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleCloseDepartmentDialog()}>
                <PlusIcon className="w-4 h-4 mr-2" />
                연합회
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingDepartment ? "Edit Department" : "Add New Department"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleDepartmentSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Department Name *</Label>
                  <Input
                    id="name"
                    value={departmentFormData.name}
                    onChange={(e) => setDepartmentFormData({ ...departmentFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={departmentFormData.description}
                    onChange={(e) => setDepartmentFormData({ ...departmentFormData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="contactPersonName">Contact Person Name</Label>
                  <Input
                    id="contactPersonName"
                    value={departmentFormData.contactPersonName}
                    onChange={(e) => setDepartmentFormData({ ...departmentFormData, contactPersonName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contactPersonPhone">Contact Person Phone</Label>
                  <Input
                    id="contactPersonPhone"
                    value={departmentFormData.contactPersonPhone}
                    onChange={(e) => setDepartmentFormData({ ...departmentFormData, contactPersonPhone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contactPersonEmail">Contact Person Email</Label>
                  <Input
                    id="contactPersonEmail"
                    type="email"
                    value={departmentFormData.contactPersonEmail}
                    onChange={(e) => setDepartmentFormData({ ...departmentFormData, contactPersonEmail: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDepartmentDialog}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
                  >
                    {editingDepartment ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => handleCloseTeamDialog()}>
                <PlusIcon className="w-4 h-4 mr-2" />
                지회
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTeam ? "Edit Team" : "Add New Team"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleTeamSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="departmentId">Department *</Label>
                  <Select 
                    value={teamFormData.departmentId} 
                    onValueChange={(value) => setTeamFormData({ ...teamFormData, departmentId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="teamName">Team Name *</Label>
                  <Input
                    id="teamName"
                    value={teamFormData.name}
                    onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="teamDescription">Description</Label>
                  <Textarea
                    id="teamDescription"
                    value={teamFormData.description}
                    onChange={(e) => setTeamFormData({ ...teamFormData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="teamContactPersonName">Contact Person Name</Label>
                  <Input
                    id="teamContactPersonName"
                    value={teamFormData.contactPersonName}
                    onChange={(e) => setTeamFormData({ ...teamFormData, contactPersonName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="teamContactPersonPhone">Contact Person Phone</Label>
                  <Input
                    id="teamContactPersonPhone"
                    value={teamFormData.contactPersonPhone}
                    onChange={(e) => setTeamFormData({ ...teamFormData, contactPersonPhone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="teamContactPersonEmail">Contact Person Email</Label>
                  <Input
                    id="teamContactPersonEmail"
                    type="email"
                    value={teamFormData.contactPersonEmail}
                    onChange={(e) => setTeamFormData({ ...teamFormData, contactPersonEmail: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Assigned Staff</Label>
                  <div className="border rounded-md p-4 max-h-40 overflow-y-auto">
                    {staff.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No staff members available</p>
                    ) : (
                      <div className="space-y-2">
                        {staff.map((staffMember) => (
                          <label key={staffMember.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={teamFormData.assignedStaff.includes(staffMember.id)}
                              onChange={(e) => handleStaffAssignment(staffMember.id, e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">
                              {staffMember.fullName} ({staffMember.nickName}) - {staffMember.group}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseTeamDialog}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTeamMutation.isPending || updateTeamMutation.isPending}
                  >
                    {editingTeam ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isQuickFamilyDialogOpen} onOpenChange={setIsQuickFamilyDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Quick Add Family Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleQuickFamilySubmit} className="space-y-4">
                {/* Member Type Selection */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={quickFamilyFormData.memberType === "husband" ? "default" : "outline"}
                    onClick={() => setQuickFamilyFormData({ ...quickFamilyFormData, memberType: "husband" })}
                    className="flex items-center gap-2"
                  >
                    <UsersIcon className="w-4 h-4" />
                    Husband
                  </Button>
                  <Button
                    type="button"
                    variant={quickFamilyFormData.memberType === "wife" ? "default" : "outline"}
                    onClick={() => setQuickFamilyFormData({ ...quickFamilyFormData, memberType: "wife" })}
                    className="flex items-center gap-2"
                  >
                    <HomeIcon className="w-4 h-4" />
                    Wife
                  </Button>
                </div>

                {/* Tabs for Member Info and Family Picture */}
                <Tabs defaultValue="member-info" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="member-info">Member Info</TabsTrigger>
                    <TabsTrigger value="family-picture">Family Picture</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="member-info" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="koreanName">Korean Name *</Label>
                      <Input
                        id="koreanName"
                        value={quickFamilyFormData.koreanName}
                        onChange={(e) => setQuickFamilyFormData({ ...quickFamilyFormData, koreanName: e.target.value })}
                        required
                        placeholder="한국이름"
                      />
                    </div>
                    <div>
                      <Label htmlFor="englishName">English Name</Label>
                      <Input
                        id="englishName"
                        value={quickFamilyFormData.englishName}
                        onChange={(e) => setQuickFamilyFormData({ ...quickFamilyFormData, englishName: e.target.value })}
                        placeholder="English Name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        value={quickFamilyFormData.phoneNumber}
                        onChange={(e) => handlePhoneFormat(e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={quickFamilyFormData.email}
                        onChange={(e) => setQuickFamilyFormData({ ...quickFamilyFormData, email: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="family-picture" className="space-y-4 mt-4">
                    <div>
                      <Label>Family Picture (Optional)</Label>
                      <div className="mt-2">
                        <FamilyImageUploader
                          onUploadComplete={(imageUrl) => {
                            setQuickFamilyFormData({ ...quickFamilyFormData, familyPicture: imageUrl });
                          }}
                          currentImage={quickFamilyFormData.familyPicture}
                        />
                      </div>
                      {quickFamilyFormData.familyPicture && (
                        <p className="text-sm text-muted-foreground mt-2">
                          ✓ Family picture uploaded successfully
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseQuickFamilyDialog}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createQuickFamilyMemberMutation.isPending}
                  >
                    {createQuickFamilyMemberMutation.isPending ? "Creating..." : "Create Family & Member"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        {departments.length === 0 ? (
          <div className="text-center py-12">
            <FolderIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">No departments found</h2>
            <p className="text-muted-foreground">Create your first department to get started</p>
          </div>
        ) : (
          departments.map((department) => {
            const departmentTeams = getDepartmentTeams(department.id);
            const isExpanded = expandedDepartments.has(department.id);
            
            return (
              <Card key={department.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDepartmentExpansion(department.id)}
                          className="p-0 h-6 w-6"
                        >
                          {departmentTeams.length > 0 ? (
                            isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4" />
                            )
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                        </Button>
                        <FolderIcon className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">{department.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {departmentTeams.length} team{departmentTeams.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {department.description && (
                        <p className="text-muted-foreground mt-2 ml-8">{department.description}</p>
                      )}
                      {(department.contactPersonName || department.contactPersonPhone || department.contactPersonEmail) && (
                        <div className="ml-8 mt-2 p-2 bg-muted rounded text-sm">
                          <span className="font-medium">Contact: </span>
                          {department.contactPersonName && <span>{department.contactPersonName}</span>}
                          {department.contactPersonPhone && <span> • {department.contactPersonPhone}</span>}
                          {department.contactPersonEmail && <span> • {department.contactPersonEmail}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTeamFormData({ ...teamFormData, departmentId: department.id });
                          setIsTeamDialogOpen(true);
                        }}
                        title="Add team to this department"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditDepartment(department)}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Department</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{department.name}"? This will also delete all teams in this department. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDepartment(department.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && departmentTeams.length > 0 && (
                  <CardContent className="pt-0 pl-8">
                    <div className="space-y-3">
                      {departmentTeams.map((team) => {
                        const teamFamilies = getTeamFamilies(team.id);
                        const isTeamExpanded = expandedTeams.has(team.id);
                        
                        return (
                          <div key={team.id} className="border-l-2 border-muted pl-4 py-2">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleTeamExpansion(team.id)}
                                    className="p-0 h-4 w-4"
                                  >
                                    {teamFamilies.length > 0 ? (
                                      isTeamExpanded ? (
                                        <ChevronDownIcon className="w-3 h-3" />
                                      ) : (
                                        <ChevronRightIcon className="w-3 h-3" />
                                      )
                                    ) : (
                                      <div className="w-3 h-3" />
                                    )}
                                  </Button>
                                  <UsersIcon className="w-4 h-4 text-green-600" />
                                  <span className="font-medium">{team.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {team.assignedStaff?.length || 0} staff
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {teamFamilies.length} families
                                  </Badge>
                                </div>
                              {team.description && (
                                <p className="text-sm text-muted-foreground mt-1 ml-6">{team.description}</p>
                              )}
                              {(team.contactPersonName || team.contactPersonPhone || team.contactPersonEmail) && (
                                <div className="ml-6 mt-1 text-xs text-muted-foreground">
                                  <span className="font-medium">Contact: </span>
                                  {team.contactPersonName && <span>{team.contactPersonName}</span>}
                                  {team.contactPersonPhone && <span> • {team.contactPersonPhone}</span>}
                                  {team.contactPersonEmail && <span> • {team.contactPersonEmail}</span>}
                                </div>
                              )}
                              {team.assignedStaff && team.assignedStaff.length > 0 && (
                                <div className="ml-6 mt-2 flex flex-wrap gap-1">
                                  {team.assignedStaff.map((staffId) => (
                                    <Badge key={staffId} variant="secondary" className="text-xs">
                                      {getStaffName(staffId)}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setQuickFamilyFormData({ ...quickFamilyFormData, teamId: team.id });
                                  setIsQuickFamilyDialogOpen(true);
                                }}
                                title="Quick add family member to this team"
                              >
                                <UserPlusIcon className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTeam(team)}
                              >
                                <PencilIcon className="w-3 h-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <TrashIcon className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Team</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{team.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteTeam(team.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          
                          {/* Family Members Section */}
                          {isTeamExpanded && teamFamilies.length > 0 && (
                            <div className="ml-6 mt-3 border-l-2 border-muted-foreground/20 pl-4">
                              <div className="space-y-2">
                                {teamFamilies.map((family) => (
                                  <div key={family.id} className="bg-muted/30 rounded-md p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <Users2Icon className="w-3 h-3 text-purple-600" />
                                          <span className="text-sm font-medium">{family.familyName}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {family.memberStatus}
                                          </Badge>
                                        </div>
                                        
                                        {/* Family Members */}
                                        {family.members && family.members.length > 0 && (
                                          <div className="ml-5 mt-2">
                                            <div className="flex flex-wrap gap-1">
                                              {family.members.map((member) => (
                                                <div key={member.id} className="flex items-center gap-1 text-xs bg-background rounded px-2 py-1">
                                                  <UserIcon className="w-3 h-3 text-blue-500" />
                                                  <span>
                                                    {member.koreanName}
                                                    {member.englishName && ` (${member.englishName})`}
                                                  </span>
                                                  <span className="text-muted-foreground">
                                                    - {member.relationship}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Contact Info */}
                                        {(family.phoneNumber || family.email) && (
                                          <div className="ml-5 mt-2 text-xs text-muted-foreground">
                                            {family.phoneNumber && <span>{family.phoneNumber}</span>}
                                            {family.phoneNumber && family.email && <span> • </span>}
                                            {family.email && <span>{family.email}</span>}
                                          </div>
                                        )}
                                        
                                        {/* Support Team */}
                                        {family.supportTeamMember && (
                                          <div className="ml-5 mt-1 text-xs text-muted-foreground">
                                            Support: {family.supportTeamMember}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}