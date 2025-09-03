import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, X } from "lucide-react";
import styles from "./login.module.css";
import { apiRequest } from '@/lib/queryClient';

interface StaffMember {
  id: string;
  fullName: string;
  nickName: string;
  group: string;
}

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

export default function LoginPage() {
  const [selectedStaff, setSelectedStaff] = useState("");
  const [pin, setPin] = useState("");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementWithStaff | null>(null);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const { login, isLoginPending } = useAuth();
  const { toast } = useToast();

  // Load saved credentials from localStorage
  useEffect(() => {
    const savedCredentials = localStorage.getItem('lastLoginCredentials');
    if (savedCredentials) {
      setHasSavedCredentials(true);
      try {
        const { nickname, pin: savedPin } = JSON.parse(savedCredentials);
        if (nickname) setSelectedStaff(nickname);
        if (savedPin) setPin(savedPin);
      } catch (error) {
        // If there's an error parsing, just ignore and continue
        console.warn('Error loading saved credentials:', error);
        setHasSavedCredentials(false);
      }
    } else {
      setHasSavedCredentials(false);
    }
  }, []);

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
  });

  const { data: announcements = [] } = useQuery<AnnouncementWithStaff[]>({
    queryKey: ["/api/announcements/login"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/announcements/login');
      return response.json();
    },
  });

  useEffect(() => {
    // Only auto-select default staff if no staff is selected and no saved credentials
    if (staff.length >= 2 && !selectedStaff && !hasSavedCredentials) {
      // No saved credentials, use default (second staff member)
      setSelectedStaff(staff[1].nickName);
    }
  }, [staff, selectedStaff, hasSavedCredentials]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStaff || !pin) {
      toast({
        title: "Missing Information",
        description: "Please select a staff member and enter your PIN.",
        variant: "destructive",
      });
      return;
    }

    if (pin.length !== 4) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be 4 digits.",
        variant: "destructive",
      });
      return;
    }

    try {
      await login({ nickname: selectedStaff, pin });
      
      // Save credentials to localStorage on successful login
      const credentialsToSave = {
        nickname: selectedStaff,
        pin: pin,
        lastLogin: new Date().toISOString()
      };
      localStorage.setItem('lastLoginCredentials', JSON.stringify(credentialsToSave));
      setHasSavedCredentials(true);
      
      toast({
        title: "Welcome!",
        description: "You have successfully logged in.",
      });
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const clearSavedLogin = () => {
    localStorage.removeItem('lastLoginCredentials');
    setSelectedStaff("");
    setPin("");
    setHasSavedCredentials(false);
    toast({
      title: "Cleared",
      description: "Saved login information has been cleared.",
    });
  };

  return (
    <>
      {/* Announcements Cards */}
      {announcements.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-50 space-y-2">
          {announcements.map((announcement) => (
            <Card 
              key={announcement.id}
              className="bg-white shadow-lg border-l-4 border-l-blue-500 cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => setSelectedAnnouncement(announcement)}
            >
              <CardContent className="p-8 min-h-[140px]">
                <div className="flex items-start justify-between h-full">
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {announcement.title}
                        </h3>
                        <Badge variant={getTypeBadgeVariant(announcement.type)} className="text-sm px-2 py-1">
                          {announcement.type}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-base line-clamp-4 leading-relaxed mb-3">
                        {announcement.content.replace(/<[^>]*>/g, '').substring(0, 300)}...
                      </p>
                    </div>
                    <p className="text-gray-500 text-sm mt-auto">
                      Click to view details
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Hide this announcement (could implement local storage to remember)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
    <div className={styles.container}>
      <div className={styles.background}>
        <Card className={styles.card}>
          <CardContent className={styles.cardContent}>
            <div className={styles.header}>
              <div className={styles.icon}>
                <Users className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className={styles.title}>새가족</h1>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <Label htmlFor="staff-select" className={styles.label}>
                  팀원
                </Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger data-testid="select-staff">
                    <SelectValue placeholder="Choose your nickname..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.nickName}>
                        {member.nickName} 
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.field}>
                <Label htmlFor="pin" className={styles.label}>
                  PIN
                </Label>
                <Input
                  id="pin"
                  type="text"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className={styles.pinInput}
                  data-testid="input-pin"
                />
                {hasSavedCredentials && (
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span className="flex items-center">
                      💾 Login info saved
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSavedLogin}
                      className="h-6 px-2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className={styles.submitButton}
                disabled={isLoginPending}
                data-testid="button-login"
              >
                {isLoginPending ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
