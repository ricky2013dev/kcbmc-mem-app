import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { CareLogWithStaff } from '@shared/schema';
import { formatDateForInput } from '@/utils/date-utils';
import { Plus, Edit, Trash2, Calendar, User, FileText } from 'lucide-react';

interface CareLogListProps {
  familyId: string;
}

const CARE_LOG_TYPES = [
  { value: 'text', label: 'Text Message' },
  { value: 'prayer', label: 'Prayer Request' },
  { value: 'call', label: 'Phone Call' },
  
    { value: 'visit', label: 'Home Visit' },
    { value: 'other', label: 'Other' },
 
];

const CARE_LOG_STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];



export function CareLogList({ familyId }: CareLogListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingLog, setEditingLog] = useState<CareLogWithStaff | null>(null);
  const [formData, setFormData] = useState({
    date: formatDateForInput(new Date()),
    type: 'visit',
    description: '',
    status: 'pending',
  });

  // Fetch care logs for this family
  const { data: careLogs = [], isLoading } = useQuery<CareLogWithStaff[]>({
    queryKey: ['care-logs', familyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/families/${familyId}/care-logs`);
      return await res.json();
    },
  });

  // Create care log mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/care-logs', {
        ...data,
        familyId,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-logs', familyId] });
      toast({
        title: 'Care log created',
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create',
        variant: 'destructive',
      });
    },
  });

  // Update care log mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!editingLog) throw new Error('No log selected');
      const res = await apiRequest('PUT', `/api/care-logs/${editingLog.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-logs', familyId] });
      toast({
        title: 'Care log updated',
      });
      setEditingLog(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update',
        variant: 'destructive',
      });
    },
  });

  // Delete care log mutation
  const deleteMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await apiRequest('DELETE', `/api/care-logs/${logId}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-logs', familyId] });
      toast({
        title: 'Care log deleted',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      date: formatDateForInput(new Date()), // Always reset to today's date
      type: 'visit',
      description: '',
      status: 'pending',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLog) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (log: CareLogWithStaff) => {
    setEditingLog(log);
    setFormData({
      date: log.date,
      type: log.type,
      description: log.description,
      status: log.status,
    });
  };

  const handleDelete = (logId: string) => {
    if (confirm('Are you sure you want to delete this care log? This action cannot be undone.')) {
      deleteMutation.mutate(logId);
    }
  };

  const canEditOrDelete = (log: CareLogWithStaff) => {
    return user?.group === 'ADM' || log.staffId === user?.id;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'visit': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'call': return 'bg-green-100 text-green-800 border-green-200';
      case 'email': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'text': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'meeting': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'counseling': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'prayer': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading care logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Care Log </h3>
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (open) {
            // Reset form with today's date when dialog opens
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-care-log">
              <Plus className="w-4 h-4 mr-2" />
              Add Care Log
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-care-log">
            <DialogHeader>
              <DialogTitle>Add New Care Log</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Hidden date field - automatically set to today */}
              <input
                type="hidden"
                value={formData.date}
              />
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the care activity or notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={3}
                  data-testid="textarea-care-log-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-care-log">
                  {createMutation.isPending ? 'Saving...' : 'Save Care Log'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Care Logs List */}
      {careLogs.length === 0 ? (
        <div className="p-6 border border-dashed border-gray-300 rounded-lg text-center text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />

        </div>
      ) : (
        <div className="space-y-3">
          {careLogs.map((log) => (
            <Card key={log.id} className="border-l-4 border-l-primary/30">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
            
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{log.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <User className="w-3 h-3 mr-1" />
                      {log.staff.nickName} on {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'Unknown'}
     
                    </div>
                  </div>
                  {canEditOrDelete(log) && (
                    <div className="flex gap-1 ml-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(log)}
                        data-testid={`button-edit-care-log-${log.id}`}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(log.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-care-log-${log.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingLog && (
        <Dialog open={!!editingLog} onOpenChange={() => setEditingLog(null)}>
          <DialogContent data-testid="dialog-edit-care-log">
  
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
  
      
              </div>
  
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Describe the care activity or notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={3}
                  data-testid="textarea-edit-care-log-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setEditingLog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-care-log">
                  {updateMutation.isPending ? 'Updating...' : 'Update Care Log'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}