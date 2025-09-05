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
import { Switch } from '@/components/ui/switch';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Plus, Edit, Trash2, ArrowLeft, Calendar, Globe, Eye, EyeOff, Copy, ExternalLink, Check, Files } from 'lucide-react';

interface AnnouncementWithStaff {
  id: string;
  title: string;
  content: string;
  type: 'Major' | 'Medium' | 'Minor';
  isLoginRequired: boolean;
  startDate: string;
  endDate: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
}

const announcementFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be less than 255 characters"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(['Major', 'Medium', 'Minor']),
  isLoginRequired: z.boolean(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isActive: z.boolean(),
});

type AnnouncementFormData = z.infer<typeof announcementFormSchema>;

const ANNOUNCEMENT_TYPES = [
  { value: 'Major', label: '중요 (Major)', description: 'Login시 모달로 표시' },
  { value: 'Medium', label: '보통 (Medium)', description: '기본 공지' },
  { value: 'Minor', label: '일반 (Minor)', description: '일반 공지' },
];

export default function NewsManagementPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementWithStaff | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<AnnouncementWithStaff | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check if user has admin access
  if (user?.group !== 'ADM') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to manage news announcements.</p>
          <Button onClick={() => setLocation('/')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const form = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: '',
      content: '',
      type: 'Medium',
      isLoginRequired: true,
      startDate: new Date().toISOString().slice(0, 16),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // 7 days from now
      isActive: true,
    },
  });

  const { data: announcements = [], isLoading, error, refetch } = useQuery<AnnouncementWithStaff[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/announcements');
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      return await apiRequest('POST', '/api/announcements', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({
        title: "Success",
        description: "News announcement created successfully.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create announcement.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AnnouncementFormData> }) => {
      return await apiRequest('PUT', `/api/announcements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({
        title: "Success",
        description: "News announcement updated successfully.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update announcement.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({
        title: "Success",
        description: "News announcement deleted successfully.",
      });
      setShowDeleteDialog(false);
      setAnnouncementToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete announcement.",
        variant: "destructive",
      });
    },
  });

  const handleAddAnnouncement = () => {
    setEditingAnnouncement(null);
    form.reset({
      title: '',
      content: '',
      type: 'Medium',
      isLoginRequired: true,
      startDate: new Date().toISOString().slice(0, 16),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      isActive: true,
    });
    setShowDialog(true);
  };

  const handleEditAnnouncement = (announcement: AnnouncementWithStaff) => {
    setEditingAnnouncement(announcement);
    form.reset({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      isLoginRequired: announcement.isLoginRequired,
      startDate: new Date(announcement.startDate).toISOString().slice(0, 16),
      endDate: new Date(announcement.endDate).toISOString().slice(0, 16),
      isActive: announcement.isActive,
    });
    setShowDialog(true);
  };

  const handleCopyAnnouncement = (announcement: AnnouncementWithStaff) => {
    setEditingAnnouncement(null); // This will be a new announcement
    form.reset({
      title: `Copy of ${announcement.title}`,
      content: announcement.content,
      type: announcement.type,
      isLoginRequired: announcement.isLoginRequired,
      startDate: new Date().toISOString().slice(0, 16), // Reset to current time
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // 7 days from now
      isActive: true, // Default to active for new copy
    });
    setShowDialog(true);
    toast({
      title: "Copying Announcement",
      description: "Pre-filled with existing announcement data. Modify as needed.",
    });
  };

  const handleDeleteAnnouncement = (announcement: AnnouncementWithStaff) => {
    setAnnouncementToDelete(announcement);
    setShowDeleteDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingAnnouncement(null);
    form.reset();
  };

  const onSubmit = (data: AnnouncementFormData) => {
    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (announcementToDelete) {
      deleteMutation.mutate(announcementToDelete.id);
    }
  };

  const getPublicUrl = (announcementId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/announcement/${announcementId}`;
  };

  const copyPublicUrl = async (announcement: AnnouncementWithStaff) => {
    if (announcement.isLoginRequired) {
      toast({
        title: "Cannot Copy URL",
        description: "This announcement requires login and doesn't have a public URL.",
        variant: "destructive",
      });
      return;
    }

    const publicUrl = getPublicUrl(announcement.id);
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedId(announcement.id);
      toast({
        title: "URL Copied!",
        description: "Public announcement URL has been copied to clipboard.",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL to clipboard. Please copy manually.",
        variant: "destructive",
      });
    }
  };

  const openPublicUrl = (announcement: AnnouncementWithStaff) => {
    if (announcement.isLoginRequired) {
      toast({
        title: "Cannot Open URL",
        description: "This announcement requires login and doesn't have a public URL.",
        variant: "destructive",
      });
      return;
    }

    const publicUrl = getPublicUrl(announcement.id);
    window.open(publicUrl, '_blank');
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'Major': return 'destructive';
      case 'Medium': return 'default';
      case 'Minor': return 'secondary';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const isDateRangeActive = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= now && now <= end;
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
                  <Globe className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-primary" />
                  News Management
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  Create and manage announcements for staff
                </p>
              </div>
            </div>
            <Button 
              onClick={handleAddAnnouncement} 
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Announcement
            </Button>
          </div>
        </div>

        {/* Announcements List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="w-5 h-5 mr-2" />
              Announcements ({announcements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600">Loading announcements...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <div className="text-red-600 text-4xl mb-4">⚠️</div>
                <p>Error loading announcements: {error.message}</p>
                <Button 
                  variant="outline" 
                  onClick={() => refetch()} 
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No announcements found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="flex flex-col p-4 border border-gray-200 rounded-lg hover:bg-gray-50 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between space-y-3 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                            {announcement.title}
                          </h3>
                          <Badge variant={getTypeBadgeVariant(announcement.type)} className="text-xs">
                            {announcement.type}
                          </Badge>
                          {announcement.isLoginRequired ? (
                            <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">
                              <Eye className="w-3 h-3 mr-1" />
                              After Login
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                              <EyeOff className="w-3 h-3 mr-1" />
                              Before Login
                            </Badge>
                          )}
                          {!announcement.isActive && (
                            <Badge variant="outline" className="text-red-600 border-red-200 text-xs">
                              Inactive
                            </Badge>
                          )}
                          {isDateRangeActive(announcement.startDate, announcement.endDate) ? (
                            <Badge variant="default" className="bg-green-600 text-white text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-600 border-gray-300 text-xs">
                              Scheduled
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span className="mr-4">
                              {formatDate(announcement.startDate)} - {formatDate(announcement.endDate)}
                            </span>
                          </div>
                          <div>
                            Created by: <span className="font-medium">{announcement.createdByStaff.fullName}</span>
                          </div>
                          {!announcement.isLoginRequired && (
                            <div className="flex items-center space-x-2 py-2">
                              <span className="text-gray-500 text-xs">Public URL:</span>
                              <div className="flex items-center space-x-1 bg-gray-50 rounded px-2 py-1 text-xs font-mono text-gray-700 border">
                                <span className="truncate max-w-xs">
                                  {getPublicUrl(announcement.id)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 hover:bg-gray-200"
                                  onClick={() => copyPublicUrl(announcement)}
                                >
                                  {copiedId === announcement.id ? (
                                    <Check className="w-3 h-3 text-green-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 hover:bg-gray-200"
                                  onClick={() => openPublicUrl(announcement)}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className="max-w-md">
                            <span className="text-gray-500">Content:</span> 
                            <div 
                              className="inline ml-1 text-gray-700 line-clamp-2"
                              dangerouslySetInnerHTML={{ 
                                __html: announcement.content.length > 100 
                                  ? announcement.content.substring(0, 100) + '...' 
                                  : announcement.content 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 sm:flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyAnnouncement(announcement)}
                          className="flex-1 sm:flex-none text-blue-600 border-blue-200 hover:bg-blue-50 text-xs sm:text-sm"
                          title="Create a copy of this announcement"
                        >
                          <Files className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditAnnouncement(announcement)}
                          className="flex-1 sm:flex-none text-xs sm:text-sm"
                        >
                          <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAnnouncement(announcement)}
                          className="flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50 text-xs sm:text-sm"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="w-full max-w-2xl mx-2 sm:mx-4 md:mx-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {editingAnnouncement ? 'Edit Announcement' : 'Add New Announcement'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter announcement title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Enter announcement content..."
                          className="min-h-[150px] sm:min-h-[200px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ANNOUNCEMENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div>
                                <div>{type.label}</div>
                                <div className="text-xs text-gray-500">{type.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date & Time</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="datetime-local"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date & Time</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="datetime-local"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isLoginRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 sm:p-4 space-y-2 sm:space-y-0">
                      <div className="space-y-0.5 flex-1">
                        <FormLabel className="text-sm sm:text-base">
                          Require Login to View
                        </FormLabel>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          {field.value 
                            ? "Show only after login (dashboard)" 
                            : "Show before login (login page)"
                          }
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 sm:p-4 space-y-2 sm:space-y-0">
                      <div className="space-y-0.5 flex-1">
                        <FormLabel className="text-sm sm:text-base">
                          Active
                        </FormLabel>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          Enable or disable this announcement
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2 flex-col sm:flex-row pt-4 sm:pt-6">
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
                    ) : editingAnnouncement ? (
                      "Update Announcement"
                    ) : (
                      "Create Announcement"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="w-full max-w-md mx-2 sm:mx-4 md:mx-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Confirm Deletion</DialogTitle>
            </DialogHeader>
            <p className="text-gray-600 text-sm sm:text-base">
              Are you sure you want to delete the announcement{' '}
              <span className="font-semibold">"{announcementToDelete?.title}"</span>?
              This action cannot be undone.
            </p>
            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setAnnouncementToDelete(null);
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
      </div>
    </div>
  );
}