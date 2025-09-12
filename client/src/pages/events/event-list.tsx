import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import { EventWithStaff } from '@server/schema';
import { formatDateForInput } from '@/utils/date-utils';
import { Calendar, Clock, MapPin, Plus, Edit, Trash2, Users, LogOut, MoreVertical, Menu, Settings, Globe, Bell, ArrowLeft, User } from 'lucide-react';
import { RefreshButton } from '@/components/RefreshButton';

interface EventListPageProps {}

export default function EventListPage({}: EventListPageProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeOnly, setActiveOnly] = useState(true);

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: [`/api/events?active=${activeOnly}`],
  });

  const handleCreateEvent = () => {
    navigate('/events/new');
  };

  const handleEditEvent = (eventId: string) => {
    navigate(`/events/${eventId}/edit`);
  };

  const handleViewEvent = (eventId: string) => {
    navigate(`/events/${eventId}`);
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to delete the event "${eventTitle}"?`)) {
      return;
    }

    try {
      await apiRequest('DELETE', `/api/events/${eventId}`);
      toast({
        title: 'Success',
        description: 'Event deleted successfully',
      });
      // Force refresh all event-related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === '/api/events' || 
                 (typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/events'));
        }
      });
      refetch();
    } catch (error) {
      console.error('Delete event error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'destructive',
      });
    }
  };

  const getEventStatusBadge = (event: EventWithStaff) => {
    const eventDate = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    if (!event.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    if (eventDate < today) {
      return <Badge variant="outline">Past</Badge>;
    } else if (eventDate.getTime() === today.getTime()) {
      return <Badge variant="default">Today</Badge>;
    } else {
      return <Badge variant="secondary">Upcoming</Badge>;
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isAdmin = user?.group === 'ADM' || user?.group === 'MGM';
  const canAddEvent = user?.group === 'ADM';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-foreground p-2 sm:px-3"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Home</span>
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Events
              </h1>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2">
              <RefreshButton onRefresh={() => refetch()} />

              {canAddEvent && (
                <Button onClick={handleCreateEvent} size="sm" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Event</span>
                </Button>
              )}

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
                  {isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/staff-management')}>
                        <Settings className="h-4 w-4 mr-2" />
                        Staff Management
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/news-management')}>
                        <Bell className="h-4 w-4 mr-2" />
                        News Management
                      </DropdownMenuItem>
                    </>
                  )}
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

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-center sm:justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 bg-white/60 backdrop-blur-sm rounded-xl p-1 shadow-lg border border-white/20">
              <Button
                variant={activeOnly ? "default" : "ghost"}
                onClick={() => setActiveOnly(true)}
                className={`rounded-lg px-3 sm:px-6 py-2 text-sm font-medium transition-all ${
                  activeOnly 
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg" 
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                Active Events
              </Button>
              <Button
                variant={!activeOnly ? "default" : "ghost"}
                onClick={() => setActiveOnly(false)}
                className={`rounded-lg px-3 sm:px-6 py-2 text-sm font-medium transition-all ${
                  !activeOnly 
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg" 
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                All Events
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6">
          {events.length === 0 ? (
            <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl">
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800">No events found</h3>
                <p className="text-muted-foreground mb-4">
                  {activeOnly ? "No active events at the moment." : "No events have been created yet."}
                </p>
                {canAddEvent && (
                  <Button onClick={handleCreateEvent} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Event
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            events.map((event) => (
              <Card key={event.id} className="bg-white/60 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-3 flex-wrap">
                        <CardTitle className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">{event.title}</CardTitle>
                        {getEventStatusBadge(event)}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-blue-500" />
                          <span className="truncate">{formatEventDate(event.date)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-green-500" />
                          <span>{event.time}</span>
                        </div>
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1 text-red-500" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 sm:ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEvent(event.id)}
                        className="bg-white/50 border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700 flex-1 sm:flex-initial"
                      >
                        <Users className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">View Attendance</span>
                        <span className="sm:hidden">View Attendance</span>
                      </Button>
                      
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="hover:bg-white/50 p-2">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white/90 backdrop-blur-md">
                            <DropdownMenuItem onClick={() => handleEditEvent(event.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Event
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteEvent(event.id, event.title)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Event
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>


              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}