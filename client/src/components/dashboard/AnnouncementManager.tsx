import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
// Local formatDate function
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ko-KR');
};
import { AlertCircle, X } from 'lucide-react';

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

interface AnnouncementManagerProps {
  className?: string;
}

export function AnnouncementManager({ className = "" }: AnnouncementManagerProps) {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementWithStaff | null>(null);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [majorAnnouncementModal, setMajorAnnouncementModal] = useState<AnnouncementWithStaff | null>(null);
  const [shownMajorAnnouncements, setShownMajorAnnouncements] = useState<Set<string>>(new Set());

  // Query for active announcements
  const { data: allAnnouncements = [] } = useQuery<AnnouncementWithStaff[]>({
    queryKey: ['announcements/active'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/announcements/active');
      return response.json();
    },
  });

  // Filter announcements for dashboard banners (login required = true)
  const dashboardAnnouncements = allAnnouncements.filter(a => a.isLoginRequired);

  // Filter major announcements that should be shown as modals
  const majorAnnouncements = allAnnouncements.filter(a => a.type === 'Major' && a.isLoginRequired);

  // Show major announcements as modal when they load
  useEffect(() => {
    if (majorAnnouncements.length > 0) {
      const unshownMajorAnnouncement = majorAnnouncements.find(
        announcement => !shownMajorAnnouncements.has(announcement.id)
      );

      if (unshownMajorAnnouncement && !majorAnnouncementModal) {
        setMajorAnnouncementModal(unshownMajorAnnouncement);
        setShownMajorAnnouncements(prev => new Set(prev).add(unshownMajorAnnouncement.id));
      }
    }
  }, [majorAnnouncements, shownMajorAnnouncements, majorAnnouncementModal]);

  const handleDismissAnnouncement = (announcementId: string) => {
    setDismissedAnnouncements(prev => new Set(prev).add(announcementId));
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'Major': return 'destructive';
      case 'Medium': return 'default';
      case 'Minor': return 'secondary';
      default: return 'secondary';
    }
  };

  const getAnnouncementStyles = (type: string) => {
    switch (type) {
      case 'Major':
        return {
          container: 'bg-red-50 border-red-200 hover:bg-red-100',
          icon: 'text-red-600'
        };
      case 'Medium':
        return {
          container: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
          icon: 'text-blue-600'
        };
      default:
        return {
          container: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
          icon: 'text-gray-600'
        };
    }
  };

  const visibleAnnouncements = dashboardAnnouncements.filter(
    announcement => !dismissedAnnouncements.has(announcement.id) && announcement.type !== 'Major'
  );

  const handleNextMajorAnnouncement = () => {
    setMajorAnnouncementModal(null);
    // Check if there are more major announcements to show
    const nextMajorAnnouncement = majorAnnouncements.find(
      announcement => !shownMajorAnnouncements.has(announcement.id)
    );
    if (nextMajorAnnouncement) {
      setTimeout(() => {
        setMajorAnnouncementModal(nextMajorAnnouncement);
        setShownMajorAnnouncements(prev => new Set(prev).add(nextMajorAnnouncement.id));
      }, 100);
    }
  };

  const remainingMajorAnnouncements = majorAnnouncements.filter(a => !shownMajorAnnouncements.has(a.id)).length;

  return (
    <>
      {/* Announcement Banners */}
      {visibleAnnouncements.length > 0 && (
        <div className={`px-4 py-2 space-y-2 ${className}`}>
          {visibleAnnouncements.map((announcement) => {
            const styles = getAnnouncementStyles(announcement.type);

            return (
              <div
                key={announcement.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${styles.container}`}
                onClick={() => setSelectedAnnouncement(announcement)}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <AlertCircle className={`w-5 h-5 ${styles.icon}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 text-sm">
                        {announcement.title}
                      </h4>
                      <Badge variant={getTypeBadgeVariant(announcement.type)} className="text-xs">
                        {announcement.type}
                      </Badge>
                    </div>
                    <p className="text-gray-600 text-xs truncate max-w-md">
                      {announcement.content.replace(/<[^>]*>/g, '')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismissAnnouncement(announcement.id);
                    }}
                    title="Dismiss announcement"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Announcement Detail Modal */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="max-w-2xl">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedAnnouncement.title}
                  <Badge variant={getTypeBadgeVariant(selectedAnnouncement.type)} className="text-xs">
                    {selectedAnnouncement.type}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  View full announcement details and information
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
                />
                <div className="text-xs text-gray-500 pt-4 border-t">
                  <p>Posted by: {selectedAnnouncement.createdByStaff.fullName}</p>
                  <p>Active until: {formatDate(selectedAnnouncement.endDate)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setSelectedAnnouncement(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Major Announcement Modal */}
      <Dialog open={!!majorAnnouncementModal} onOpenChange={() => setMajorAnnouncementModal(null)}>
        <DialogContent className="max-w-2xl">
          {majorAnnouncementModal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  {majorAnnouncementModal.title}
                  <Badge variant="destructive" className="text-xs">
                    {majorAnnouncementModal.type}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Important announcement that requires your attention
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: majorAnnouncementModal.content }}
                />
                <div className="text-xs text-gray-500 pt-4 border-t">
                  <p>Posted by: {majorAnnouncementModal.createdByStaff.fullName}</p>
                  <p>Active until: {formatDate(majorAnnouncementModal.endDate)}</p>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={handleNextMajorAnnouncement}
                >
                  {remainingMajorAnnouncements > 1 ? 'Next' : 'OK'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook for footer announcements (separate from main announcement manager)
export function useFooterAnnouncements() {
  return useQuery<AnnouncementWithStaff[]>({
    queryKey: ['announcements/all'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/announcements');
      const announcements = await response.json();
      // Filter only active announcements
      return announcements.filter((ann: any) => ann.isActive);
    },
  });
}

// Utility function for announcement badge variants (exported for reuse)
export function getAnnouncementBadgeVariant(type: string) {
  switch (type) {
    case 'Major': return 'destructive';
    case 'Medium': return 'default';
    case 'Minor': return 'secondary';
    default: return 'secondary';
  }
}

// Type export for reuse
export type { AnnouncementWithStaff };