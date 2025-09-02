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
import { Users } from "lucide-react";
import styles from "./login.module.css";

interface StaffMember {
  id: string;
  fullName: string;
  nickName: string;
  group: string;
}

export default function LoginPage() {
  const [selectedStaff, setSelectedStaff] = useState("");
  const [pin, setPin] = useState("");
  const { login, isLoginPending } = useAuth();
  const { toast } = useToast();

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
  });

  useEffect(() => {
    if (staff.length >= 2 && !selectedStaff) {
      setSelectedStaff(staff[1].nickName);
    }
  }, [staff, selectedStaff]);

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

  return (
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
