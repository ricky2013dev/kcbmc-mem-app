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
import { Bell, ExternalLink, X } from "lucide-react";
import styles from "./login.module.css";
import { apiRequest } from '@/lib/queryClient';

interface StaffMember {
  id: string;
  fullName: string;
  nickName: string;
  group: string;
}

interface PublicAnnouncement {
  id: string;
  title: string;
  type: 'Major' | 'Medium' | 'Minor';
}


export default function LoginPage() {
  const [selectedStaff, setSelectedStaff] = useState("");
  const [pin, setPin] = useState("");
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const { login, isLoginPending } = useAuth();
  const { toast } = useToast();

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
  });

  // Load saved credentials from localStorage when staff data is available
  useEffect(() => {
    if (staff.length === 0) return; // Wait for staff data to load
    
    const savedCredentials = localStorage.getItem('lastLoginCredentials');
    if (savedCredentials) {
      setHasSavedCredentials(true);
      try {
        const { memberId, nickName, pin: savedPin } = JSON.parse(savedCredentials);
        
        // If we have memberId, find the member and use their current nickName
        // Otherwise, fallback to the saved nickName for backwards compatibility
        if (memberId) {
          const member = staff.find(m => m.id === memberId);
          if (member) {
            setSelectedStaff(member.nickName);
          } else if (nickName) {
            // Member ID not found, fallback to nickName
            setSelectedStaff(nickName);
          }
        } else if (nickName) {
          setSelectedStaff(nickName);
        }
        
        if (savedPin) setPin(savedPin);
      } catch (error) {
        // If there's an error parsing, just ignore and continue
        console.warn('Error loading saved credentials:', error);
        setHasSavedCredentials(false);
      }
    } else {
      setHasSavedCredentials(false);
    }
  }, [staff.length]); // Use staff.length to avoid constant re-renders

  // Query for public announcements (only non-login-required ones)
  const { data: publicAnnouncements = [] } = useQuery<PublicAnnouncement[]>({
    queryKey: ["/api/announcements/login"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/announcements/login');
      const announcements = await response.json();
      // Filter only non-login-required announcements
      return announcements.filter((ann: any) => !ann.isLoginRequired);
    },
  });



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
      const selectedMember = staff.find(m => m.nickName === selectedStaff);
      const credentialsToSave = {
        memberId: selectedMember?.id, // Save the member ID for reliable lookup
        nickName: selectedStaff, // Keep nickName for backwards compatibility
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
    <div className={styles.container}>
      <div className={styles.background}>
        <Card className={`${styles.card} relative`}>
          <CardContent className={styles.cardContent}>
            <div className={styles.header}>
              <div className={styles.icon}>
                <img
                  src="/kcmbc-logo.svg"
                  alt="KCMBC Logo"
               
                />
              </div>
              <h1 className={styles.title}>KCBMC Member</h1>
              {publicAnnouncements.length > 0 && (
                <div className="absolute top-4 right-4">
                  <div className="relative group">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all duration-200"
                      onClick={() => {
                        if (publicAnnouncements.length === 1) {
                          window.open(`/announcement/${publicAnnouncements[0].id}`, '_blank');
                        }
                      }}
                      title={publicAnnouncements.length === 1 
                        ? `View announcement: ${publicAnnouncements[0].title}` 
                        : `${publicAnnouncements.length} public announcements available`}
                    >
                      <Bell className="h-5 w-5 text-blue-600" />
                    </Button>
                    
                    {/* Notification badge */}
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {publicAnnouncements.length > 9 ? '9+' : publicAnnouncements.length}
                    </div>
                    
                    {/* Dropdown for multiple announcements */}
                    {publicAnnouncements.length > 1 && (
                      <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <div className="p-3 border-b border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-900">Public Announcements</h3>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {publicAnnouncements.map((announcement) => (
                            <div
                              key={announcement.id}
                              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0"
                              onClick={() => window.open(`/announcement/${announcement.id}`, '_blank')}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {announcement.title}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {announcement.type} Priority
                                  </p>
                                </div>
                                <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0 ml-2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {/* Hidden username field for accessibility */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={selectedStaff}
                onChange={() => {}} // Read-only, controlled by Select
                style={{ display: 'none' }}
                tabIndex={-1}
                aria-hidden="true"
              />
              
              <div className={styles.field}>
                <Label htmlFor="staff-select" className={styles.label}>
                  팀원
                </Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger data-testid="select-staff">
                    <SelectValue placeholder="Choose your nickname..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.filter((member) => member.nickName && member.nickName.trim() !== '').map((member) => (
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
                <div className="relative">
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className={styles.pinInput}
                    data-testid="input-pin"
                  />
                  {pin && (
                    <button
                      type="button"
                      onClick={() => setPin("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Clear PIN"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
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
  );
}
