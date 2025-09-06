import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import { Event } from '@shared/schema';
import { formatDateForInput, getNextSunday } from '@/utils/date-utils';
import { Calendar, Clock, MapPin, Save, ArrowLeft, User, LogOut, Settings, Bell, AlertCircle, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EventFormPageProps {
  mode: 'create' | 'edit';
  eventId?: string;
}

export default function EventFormPage({ mode, eventId: propEventId }: EventFormPageProps) {
  const params = useParams();
  const eventId = propEventId || params.id;
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    title: '',
    date: formatDateForInput(getNextSunday(new Date())), // Default to next Sunday
    time: '10:30', // Default time
    location: '',
    isActive: true,
  });

  // Auto-update date to nearest Sunday when date changes
  const handleDateChange = (dateValue: string) => {
    const selectedDate = new Date(dateValue);
    const nearestSunday = selectedDate.getDay() === 0 ? selectedDate : getNextSunday(selectedDate);
    const formattedSunday = formatDateForInput(nearestSunday);
    
    handleInputChange('date', formattedSunday);
    
    if (formattedSunday !== dateValue) {
      toast({
        title: 'Date adjusted',
        description: `Date was automatically adjusted to the nearest Sunday (${nearestSunday.toLocaleDateString()})`,
      });
    }
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: [`/api/events/${eventId}`],
    enabled: mode === 'edit' && !!eventId,
  });

  useEffect(() => {
    if (mode === 'edit' && event) {
      setFormData({
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        isActive: event.isActive,
      });
    }
  }, [mode, event]);

  const createEventMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest('POST', '/api/events', data),
    onSuccess: () => {
      // Invalidate all event-related queries to refresh the event list
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === '/api/events' || 
                 (typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/events'));
        }
      });
      toast({
        title: 'Success',
        description: 'Event created successfully',
      });
      navigate('/events');
    },
    onError: (error: any) => {
      console.error('Create event error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create event',
        variant: 'destructive',
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest('PUT', `/api/events/${eventId}`, data),
    onSuccess: () => {
      // Invalidate all event-related queries to refresh the event list
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      // Also invalidate queries with parameters (active/all events)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === '/api/events' || 
                 (typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/events'));
        }
      });
      toast({
        title: 'Success',
        description: 'Event updated successfully',
      });
      navigate('/events');
    },
    onError: (error: any) => {
      console.error('Update event error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update event',
        variant: 'destructive',
      });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today && mode === 'create') {
        newErrors.date = 'Event date cannot be in the past';
      }
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        await createEventMutation.mutateAsync(formData);
      } else {
        await updateEventMutation.mutateAsync(formData);
      }
    } catch (error) {
      // Error handling is done in mutation onError
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const isAdmin = user?.group === 'ADM' || user?.group === 'MGM';

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to manage events.</p>
          <Button onClick={() => navigate('/events')}>Back to Events</Button>
        </div>
      </div>
    );
  }

  if (mode === 'edit' && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (mode === 'edit' && !isLoading && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
          <p className="text-muted-foreground mb-4">The event you're trying to edit doesn't exist.</p>
          <Button onClick={() => navigate('/events')}>Back to Events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/events')}
                className="text-muted-foreground hover:text-foreground p-2 sm:px-3 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Events</span>
              </Button>
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                {mode === 'create' ? 'Create New Event' : 'Edit Event'}
              </h1>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2 sm:px-3">
                    <User className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{user?.nickName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white/90 backdrop-blur-md">
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/staff-management')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Staff Management
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/news-management')}>
                    <Bell className="h-4 w-4 mr-2" />
                    News Management
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-3 text-lg sm:text-xl">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Event Information
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium text-gray-700">Event Title *</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Enter event title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`bg-white/70 backdrop-blur-sm border-0 shadow-md focus:shadow-lg transition-all ${errors.title ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-blue-500'}`}
                />
                {errors.title && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.title}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700">Date *</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className={`pl-14 bg-white/70 backdrop-blur-sm border-0 shadow-md focus:shadow-lg transition-all ${errors.date ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-blue-500'}`}
                    />
                  </div>
                  {errors.date && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.date}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="text-sm font-medium text-gray-700">Time *</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      className={`pl-14 bg-white/70 backdrop-blur-sm border-0 shadow-md focus:shadow-lg transition-all ${errors.time ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-green-500'}`}
                    />
                  </div>
                  {errors.time && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.time}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-medium text-gray-700">Location *</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                    <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <Input
                    id="location"
                    type="text"
                    placeholder="Enter event location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className={`pl-14 bg-white/70 backdrop-blur-sm border-0 shadow-md focus:shadow-lg transition-all ${errors.location ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-red-500'}`}
                  />
                </div>
                {errors.location && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.location}</p>}
              </div>

              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <Label htmlFor="isActive" className="text-sm font-medium text-gray-800 cursor-pointer">Active Event</Label>
                    <p className="text-xs text-gray-600">Allow people to view and register for this event</p>
                  </div>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-600"
                />
              </div>

              {mode === 'create' && (
                <Alert className="border-0 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md">
                  <div className="flex">
                    <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <AlertCircle className="h-4 w-4 text-white" />
                    </div>
                    <AlertDescription className="text-amber-800 text-sm">
                      When you create this event, attendance records will be automatically generated for all families in the system.
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/events')}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-white/50 border-gray-200 hover:bg-gray-50 order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg order-1 sm:order-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      <span>{mode === 'create' ? 'Creating...' : 'Updating...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      <span>{mode === 'create' ? 'Create Event' : 'Update Event'}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}