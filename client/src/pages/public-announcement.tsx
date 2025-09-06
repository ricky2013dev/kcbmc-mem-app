import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

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

export default function PublicAnnouncementPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const announcementId = params.id;

  const { data: announcement, isLoading: loading, error } = useQuery<AnnouncementWithStaff>({
    queryKey: [`/api/announcements/public/${announcementId}`],
    queryFn: async () => {
      if (!announcementId) {
        throw new Error("Announcement ID is required");
      }
      const response = await apiRequest('GET', `/api/announcements/public/${announcementId}`);
      if (!response.ok) {
        throw new Error("Announcement not found or not available publicly");
      }
      return response.json();
    },
    enabled: !!announcementId,
    retry: false,
  });

  const handleBackNavigation = () => {
    if (isAuthenticated) {
      setLocation('/');  // Go to dashboard
    } else {
      setLocation('/');  // Go to login page (will be handled by router)
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'Major': return 'destructive';
      case 'Medium': return 'default';
      case 'Minor': return 'secondary';
      default: return 'secondary';
    }
  };


  if (loading) {
    return (
      <>
        <div className="fixed top-4 left-4 z-50">
          <Button 
            onClick={handleBackNavigation}
            variant="outline"
            className="flex items-center gap-2 bg-white shadow-lg border-gray-300 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            {isAuthenticated ? 'Back to Dashboard' : 'Go to Login'}
          </Button>
        </div>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading announcement...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="fixed top-4 left-4 z-50">
          <Button 
            onClick={handleBackNavigation}
            variant="outline"
            className="flex items-center gap-2 bg-white shadow-lg border-gray-300 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            {isAuthenticated ? 'Back to Dashboard' : 'Go to Login'}
          </Button>
        </div>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 pt-20">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <div className="text-red-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Announcement Not Found</h2>
              <p className="text-gray-600 mb-4">
                {error.message || "The announcement you're looking for is not available or does not exist."}
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (!announcement) {
    return (
      <>
        <div className="fixed top-4 left-4 z-50">
          <Button 
            onClick={handleBackNavigation}
            variant="outline"
            className="flex items-center gap-2 bg-white shadow-lg border-gray-300 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            {isAuthenticated ? 'Back to Dashboard' : 'Go to Login'}
          </Button>
        </div>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 pt-20">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-2">Announcement Not Available</h2>
              <p className="text-gray-600 mb-4">
                The announcement you're looking for is not available or does not exist.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Fixed Back Button */}
      <div className="fixed top-4 left-4 z-50">
        <Button 
          onClick={handleBackNavigation}
          variant="outline"
          className="flex items-center gap-2 bg-white shadow-lg border-gray-300 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" />
          {isAuthenticated ? 'Back to Dashboard' : 'Go to Login'}
        </Button>
      </div>
      
      <div className="min-h-screen bg-gray-50 p-4 pt-20">
        <div className="max-w-4xl mx-auto">

        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {announcement.title}
                  </h1>
   
                </div>
              </div>

    
            </div>

            <div className="prose prose-lg max-w-none">
              <div 
                dangerouslySetInnerHTML={{ __html: announcement.content }}
                className="text-gray-800 leading-relaxed"
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>This is a public announcement from 새가족</p>
        </div>
        </div>
      </div>
    </>
  );
}