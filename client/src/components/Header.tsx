import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RefreshButton } from '@/components/RefreshButton';
import { Bell, LogOut, Menu, Users, Settings, Globe, Calendar, FolderOpen, UserCheck, DollarSign, Upload } from 'lucide-react';
import styles from './Header.module.css';

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

interface HeaderProps {
  footerAnnouncements?: AnnouncementWithStaff[];
  onRefresh?: () => void;
  showAnnouncementDropdown?: boolean;
  onAnnouncementDropdownChange?: (show: boolean) => void;
}

export function Header({
  footerAnnouncements = [],
  onRefresh,
  showAnnouncementDropdown = false,
  onAnnouncementDropdownChange
}: HeaderProps) {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleAnnouncementClick = () => {
    if (footerAnnouncements.length === 1) {
      setLocation(`/announcement/${footerAnnouncements[0].id}`);
    } else {
      onAnnouncementDropdownChange?.(!showAnnouncementDropdown);
    }
  };

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/',
      icon: Users,
      className: 'text-blue-700 hover:text-primary-foreground/80',
      testId: 'button-dashboard'
    },
    {
      label: '지회(트리뷰)',
      path: '/departments',
      icon: FolderOpen,
      className: 'text-orange-700 hover:text-primary-foreground/80',
      testId: 'button-departments'
    },

    {
      label: 'Donations',
      path: '/donations',
      icon: DollarSign,
      className: 'text-emerald-700 hover:text-primary-foreground/80',
      testId: 'button-donations'
    },

  ];

  const adminMenuItems = [
        {
      label: '지회(카드뷰)',
      path: '/family-dashboard',
      icon: Users,
      className: 'text-cyan-700 hover:text-primary-foreground/80',
      testId: 'button-family-dashboard'
    },
    {
      label: 'Staff',
      path: '/staff-management',
      icon: Settings,
      className: 'text-blue-700 hover:text-primary-foreground/80',
      testId: 'button-staff-management'
    },
    {
      label: 'Teams',
      path: '/teams',
      icon: UserCheck,
      className: 'text-indigo-700 hover:text-primary-foreground/80',
      testId: 'button-teams'
    },
    {
      label: 'News',
      path: '/news-management',
      icon: Globe,
      className: 'text-green-700 hover:text-primary-foreground/80',
      testId: 'button-news-management'
    },
    {
      label: 'Events',
      path: '/events',
      icon: Calendar,
      className: 'text-purple-700 hover:text-primary-foreground/80',
      testId: 'button-events'
    }
  ];

  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <div className={styles.navLeft}>
          <div className={styles.navIcon}>
            <img
              src="/kcmbc-logo.svg"
              alt="KCMBC Logo"
              className="w-5 h-5"
            />
          </div>
          <h1 className={styles.navTitle}>Member</h1>
        </div>

        {/* Announcements & Refresh Button - Center */}
        <div className="flex-1 flex justify-center items-center gap-12">
          {/* News Announcement Bell */}
          {footerAnnouncements.length > 0 && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={handleAnnouncementClick}
                title={footerAnnouncements.length === 1
                  ? `View announcement: ${footerAnnouncements[0].title}`
                  : `${footerAnnouncements.length} announcements available`}
              >
                <Bell className="h-4 w-4" />
              </Button>

              {/* Notification badge */}
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {footerAnnouncements.length > 9 ? '9+' : footerAnnouncements.length}
              </div>

              {/* Dropdown for multiple announcements */}
              {footerAnnouncements.length > 1 && showAnnouncementDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => onAnnouncementDropdownChange?.(false)}
                  />

                  {/* Dropdown content */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900">Announcements</h3>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {footerAnnouncements.map((announcement) => (
                        <div
                          key={announcement.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0"
                          onClick={() => {
                            setLocation(`/announcement/${announcement.id}`);
                            onAnnouncementDropdownChange?.(false);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {announcement.title}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(announcement.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {onRefresh && <RefreshButton onRefresh={onRefresh} />}
        </div>

        <div className={styles.navRight}>
          {/* Desktop Menu - Hidden on Mobile */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Common menu items */}
            <div className="flex space-x-2">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant="secondary"
                    size="sm"
                    onClick={() => setLocation(item.path)}
                    data-testid={item.testId}
                    className={item.className}
                    title={item.label}
                  >
                    <IconComponent className="w-4 h-4" /> {item.label}
                  </Button>
                );
              })}
            </div>

            {/* Admin-only menu items */}
            {user?.group === 'ADM' && (
              <div className="flex space-x-2">
                {adminMenuItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Button
                      key={item.path}
                      variant="secondary"
                      size="sm"
                      onClick={() => setLocation(item.path)}
                      data-testid={item.testId}
                      className={item.className}
                      title={item.label}
                    >
                      <IconComponent className="w-4 h-4" /> {item.label}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* CSV Upload for ADM and MGM */}
            {(user?.group === 'ADM' || user?.group === 'MGM') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLocation('/csv-upload')}
                data-testid="button-csv-upload"
                className="text-pink-700 hover:text-primary-foreground/80"
                title="Upload CSV"
              >
                <Upload className="w-4 h-4" /> Upload CSV
              </Button>
            )}

            <span className={styles.userName} data-testid="text-current-user">
              {user?.group === 'ADM' ? user?.group : `${user?.fullName} (${user?.group})`}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className={styles.logoutButton}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-1" />
              <span>Logout</span>
            </Button>
          </div>

          {/* Mobile Hamburger Menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="lg" className="p-3">
                  <Menu className="w-7 h-7 stroke-[4px] text-blue-600 font-black" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 text-sm font-medium text-gray-900 border-b">
                  {user?.group === 'ADM' ? user?.group : `${user?.fullName} (${user?.group})`}
                </div>

                {/* Common menu items for mobile */}
                <DropdownMenuSeparator />
                {menuItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <DropdownMenuItem key={item.path} onClick={() => setLocation(item.path)}>
                      <IconComponent className="w-4 h-4 mr-2" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}

                {/* Admin-only menu items for mobile */}
                {user?.group === 'ADM' && (
                  <>
                    <DropdownMenuSeparator />
                    {adminMenuItems.map((item) => {
                      const IconComponent = item.icon;
                      return (
                        <DropdownMenuItem key={item.path} onClick={() => setLocation(item.path)}>
                          <IconComponent className="w-4 h-4 mr-2" />
                          {item.label}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuItem onClick={() => setLocation('/teams')}>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Teams
                    </DropdownMenuItem>
                  </>
                )}

                {/* CSV Upload for ADM and MGM - Mobile */}
                {(user?.group === 'ADM' || user?.group === 'MGM') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation('/csv-upload')}>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload CSV
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}