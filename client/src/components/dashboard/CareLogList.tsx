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
import { CareLogWithStaff } from '@server/schema';
import { formatDateForInput } from '@/utils/date-utils';
import { Plus, Edit, Trash2, Calendar, User, FileText, List, AlignLeft, Copy, Shield, AlertTriangle } from 'lucide-react';

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
  const [viewMode, setViewMode] = useState<'list' | 'merged'>('list');
  const [showMergedDialog, setShowMergedDialog] = useState(false);

  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ['care-logs-data', familyId] });
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
      queryClient.invalidateQueries({ queryKey: ['care-logs-data', familyId] });
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
      queryClient.invalidateQueries({ queryKey: ['care-logs-data', familyId] });
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

  const generateMergedText = () => {
    if (careLogs.length === 0) return 'No care logs available.';
    
    // Sort logs by date (newest first)
    const sortedLogs = [...careLogs].sort((a, b) => 
      new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
    );
    
    return sortedLogs.map((log, index) => {
      const date = new Date(log.createdAt || log.date).toLocaleDateString();
      const author = log.staff.nickName;
      return `${log.description}`;
    }).join('\n');
  };

  const copyMergedText = () => {
    const mergedText = generateMergedText();
    navigator.clipboard.writeText(mergedText).then(() => {
      toast({
        title: "Copied to clipboard",
        description: "All care logs have been copied as text.",
      });
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    });
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
    <div className="h-full flex flex-col">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">
            Care Logs {careLogs.length > 0 && `(${careLogs.length})`}
          </h3>
          {careLogs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMergedDialog(true)}
              title="View all care logs as merged text"
              className="h-8"
            >
              <AlignLeft className="w-4 h-4 mr-2" />
              Merged View
            </Button>
          )}
        </div>

        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (open) {
            // Reset form with today's date when dialog opens
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-care-log" className="h-8">
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

      {/* Care Logs Content */}
      <div className="flex-1">
        {careLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-gray-50 rounded-full p-6 mb-6">
              <FileText className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-3">No Care Logs Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Start documenting pastoral care activities for this family. Care logs help track visits,
              prayer requests, phone calls, and other important interactions.
            </p>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Track home visits and meetings</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Record prayer requests and spiritual conversations</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Document phone calls and text communications</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Note important family updates and needs</span>
              </div>
            </div>
            <div className="mt-8">
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="px-6 py-2"
                data-testid="button-add-first-care-log"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Care Log
              </Button>
            </div>
          </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {careLogs.map((log) => (
            <Card key={log.id} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3 leading-relaxed">{log.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground bg-gray-50 px-2 py-1 rounded">
                      <User className="w-3 h-3 mr-1" />
                      {log.staff.nickName} • {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'Unknown'}
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
      </div>

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

      {/* Merged View Dialog */}
      <Dialog open={showMergedDialog} onOpenChange={setShowMergedDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlignLeft className="w-5 h-5" />
              All Care Logs 
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center">

              <Button 
                size="sm" 
                variant="outline"
                onClick={copyMergedText}
                title="Copy all care logs to clipboard"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy All
              </Button>
            </div>
            <div className="border rounded-lg p-4 bg-gray-50 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 leading-relaxed">
                {generateMergedText()}
              </pre>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowMergedDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}