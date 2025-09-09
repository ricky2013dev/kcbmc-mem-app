import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { insertStaffSchema, type Staff, type StaffLoginLogWithStaff } from '@shared/schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Users, Plus, Edit, Trash2, Settings, ArrowLeft, History, Clock } from 'lucide-react';

const staffFormSchema = insertStaffSchema.extend({
  personalPin: z.string().length(4, "PIN must be exactly 4 digits").regex(/^\d+$/, "PIN must contain only numbers")
});

type StaffFormData = z.infer<typeof staffFormSchema>;

const STAFF_GROUPS = [
  { value: 'ADM', label: '관리자 (Admin)' },
  { value: 'MGM', label: '매니저 (Manager)' },
  { value: 'TEAM-A', label: '팀 A (Team A)' },
  { value: 'TEAM-B', label: '팀 B (Team B)' },
];

export default function StaffManagementPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [showLoginHistoryDialog, setShowLoginHistoryDialog] = useState(false);
  const [selectedStaffForHistory, setSelectedStaffForHistory] = useState<Staff | null>(null);

  // Check if user has super admin access
  if (user?.group !== 'ADM') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access staff management.</p>
          <Button onClick={() => setLocation('/')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      fullName: '',
      nickName: '',
      personalPin: '',
      group: 'TEAM-A',
      displayOrder: 0,
      isActive: true,
    },
  });

  // Debug query to check authentication
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-debug'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/auth/me');
        const data = await response.json();
        console.log('Current user from API:', data);
        return data;
      } catch (err) {
        console.error('Auth check failed:', err);
        return null;
      }
    },
  });

  const { data: staff = [], isLoading, error, refetch } = useQuery<Staff[]>({
    queryKey: ['staff-management'],
    queryFn: async () => {
      console.log('Fetching staff management data...');
      console.log('User group:', user?.group, 'Expected: ADM');
      try {
        const response = await apiRequest('GET', '/api/staff/manage');
        const data = await response.json();
        console.log('Staff management data received:', data);
        return data;
      } catch (err) {
        console.error('Error fetching staff data:', err);
        if (err.message.includes('Unexpected token')) {
          throw new Error('Server returned HTML instead of JSON. This usually means authentication failed or the server is misconfigured.');
        }
        throw err;
      }
    },
    enabled: user?.group === 'ADM', // Only run if user is ADM
  });

  const createMutation = useMutation({
    mutationFn: async (data: StaffFormData) => {
      return await apiRequest('POST', '/api/staff/manage', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-management'] });
      toast({
        title: "Success",
        description: "Staff member created successfully.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create staff member.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StaffFormData> }) => {
      return await apiRequest('PUT', `/api/staff/manage/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-management'] });
      toast({
        title: "Success",
        description: "Staff member updated successfully.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update staff member.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/staff/manage/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-management'] });
      toast({
        title: "Success",
        description: "Staff member deleted successfully.",
      });
      setShowDeleteDialog(false);
      setStaffToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete staff member.",
        variant: "destructive",
      });
    },
  });

  // Login history query
  const { data: loginHistory = [], isLoading: isLoadingHistory } = useQuery<StaffLoginLogWithStaff[]>({
    queryKey: ['staff-login-history', selectedStaffForHistory?.id],
    queryFn: async () => {
      if (!selectedStaffForHistory) return [];
      const response = await apiRequest('GET', `/api/staff/${selectedStaffForHistory.id}/login-logs?limit=20`);
      return await response.json();
    },
    enabled: !!selectedStaffForHistory && showLoginHistoryDialog,
  });

  const handleAddStaff = () => {
    setEditingStaff(null);
    form.reset({
      fullName: '',
      nickName: '',
      personalPin: '',
      group: 'TEAM-A',
      displayOrder: Math.max(0, ...staff.map(s => s.displayOrder || 0)) + 1,
      isActive: true,
    });
    setShowDialog(true);
  };

  const handleEditStaff = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    form.reset({
      fullName: staffMember.fullName,
      nickName: staffMember.nickName,
      personalPin: staffMember.personalPin,
      group: staffMember.group,
      displayOrder: staffMember.displayOrder || 0,
      isActive: staffMember.isActive,
    });
    setShowDialog(true);
  };

  const handleDeleteStaff = (staffMember: Staff) => {
    setStaffToDelete(staffMember);
    setShowDeleteDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingStaff(null);
    form.reset();
  };

  const onSubmit = (data: StaffFormData) => {
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (staffToDelete) {
      deleteMutation.mutate(staffToDelete.id);
    }
  };

  const handleShowLoginHistory = (staffMember: Staff) => {
    setSelectedStaffForHistory(staffMember);
    setShowLoginHistoryDialog(true);
  };

  const handleCloseLoginHistory = () => {
    setShowLoginHistoryDialog(false);
    setSelectedStaffForHistory(null);
  };

  const getGroupBadgeVariant = (group: string) => {
    switch (group) {
      case 'ADM': return 'destructive';
      case 'MGM': return 'default';
      default: return 'secondary';
    }
  };

  const getGroupLabel = (group: string) => {
    const groupOption = STAFF_GROUPS.find(g => g.value === group);
    return groupOption ? groupOption.label : group;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLocation('/')}
                className="self-start"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
                  <Settings className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-primary" />
                  Staff Management
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  Manage system users and their permissions
                  {process.env.NODE_ENV === 'development' && (
                    <span className="text-xs ml-0 sm:ml-2 text-blue-600 block sm:inline mt-1 sm:mt-0">
                      (Frontend user: {user?.fullName} - {user?.group})
                      {currentUser && (
                        <span className="ml-0 sm:ml-2 text-green-600 block sm:inline">
                          | API user: {currentUser?.fullName} - {currentUser?.group}
                        </span>
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button 
              onClick={handleAddStaff} 
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </div>
        </div>

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Staff Members ({staff.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user?.group !== 'ADM' ? (
              <div className="text-center py-8 text-amber-600">
                <div className="text-amber-600 text-4xl mb-4">⚠️</div>
                <p>You need ADM (Admin) privileges to manage staff.</p>
                <p className="text-sm mt-2">Your current group: {user?.group}</p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600">Loading staff...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <div className="text-red-600 text-4xl mb-4">⚠️</div>
                <p>Error loading staff: {error.message}</p>
                <Button 
                  variant="outline" 
                  onClick={() => refetch()} 
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            ) : staff.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No staff members found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {staff.map((staffMember) => (
                  <div
                    key={staffMember.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 space-y-3 sm:space-y-0"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                            {staffMember.fullName}
                          </h3>
                          <Badge variant={getGroupBadgeVariant(staffMember.group)} className="text-xs">
                            {getGroupLabel(staffMember.group)}
                          </Badge>
                          {!staffMember.isActive && (
                            <Badge variant="outline" className="text-red-600 border-red-200 text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 space-y-1 sm:space-y-0">
                          <div>
                            Nickname: <span className="font-medium">{staffMember.nickName}</span>
                          </div>
                          {staffMember.displayOrder !== undefined && (
                            <div className="sm:inline sm:ml-4">
                              Order: <span className="font-medium">{staffMember.displayOrder}</span>
                            </div>
                          )}
                          {staffMember.lastLogin && (
                            <div className="sm:inline sm:ml-4">
                              Last Login: <span className="font-medium">
                                {new Date(staffMember.lastLogin).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                          {!staffMember.lastLogin && (
                            <div className="sm:inline sm:ml-4">
                              Last Login: <span className="font-medium text-gray-400">Never</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 sm:flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShowLoginHistory(staffMember)}
                        className="flex-1 sm:flex-none text-xs sm:text-sm text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <History className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        History
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditStaff(staffMember)}
                        className="flex-1 sm:flex-none text-xs sm:text-sm"
                      >
                        <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Edit
                      </Button>
                      {staffMember.id !== user?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteStaff(staffMember)}
                          className="flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50 text-xs sm:text-sm"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nickName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nickname</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter nickname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="personalPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN (4 digits)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password"
                          maxLength={4}
                          placeholder="1234"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STAFF_GROUPS.map((group) => (
                            <SelectItem key={group.value} value={group.value}>
                              {group.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number"
                          min="0"
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2 flex-col sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="w-full sm:w-auto order-1 sm:order-2"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      "Saving..."
                    ) : editingStaff ? (
                      "Update Staff"
                    ) : (
                      "Add Staff"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Confirm Deletion</DialogTitle>
            </DialogHeader>
            <p className="text-gray-600 text-sm sm:text-base">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{staffToDelete?.fullName}</span>?
              This action will deactivate the staff member.
            </p>
            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setStaffToDelete(null);
                }}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Login History Dialog */}
        <Dialog open={showLoginHistoryDialog} onOpenChange={setShowLoginHistoryDialog}>
          <DialogContent className="max-w-lg mx-2 sm:mx-auto max-h-[85vh] overflow-hidden">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg flex items-center">
                <History className="w-4 h-4 mr-2" />
                <span className="truncate">
                  Login History - {selectedStaffForHistory?.fullName}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[60vh]">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-gray-600 text-sm">Loading...</span>
                </div>
              ) : loginHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No login history found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {loginHistory.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 border rounded-lg ${
                        log.success 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            log.success ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium">
                              {log.success ? 'Success' : 'Failed'}
                            </span>
                            {!log.success && log.failureReason && (
                              <span className="text-xs text-red-600 block">
                                {log.failureReason}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {new Date(log.loginTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>IP: <span className="font-mono">{log.ipAddress || 'Unknown'}</span></div>
                        <div className="break-all">
                          Agent: {log.userAgent ? (
                            log.userAgent.length > 50 ? 
                            `${log.userAgent.substring(0, 50)}...` : 
                            log.userAgent
                          ) : 'Unknown'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="pt-3">
              <Button
                variant="outline"
                onClick={handleCloseLoginHistory}
                className="w-full"
                size="sm"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}