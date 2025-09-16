import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SundayDatePicker } from "@/components/sunday-date-picker";
import { apiRequest } from "@/lib/queryClient";
import { FamilyWithMembers } from "@shared/schema";
import { formatPhoneNumber } from "@/utils/phone-format";
import {
  getGradeGroup,
  generateFamilyName,
  generateFullAddress,
  calculateGradeLevelFromBirthdate,
} from "@/utils/grade-utils";
import { formatDateForInput, getPreviousSunday } from "@/utils/date-utils";
import {
  MEMBER_STATUS_OPTIONS,
  STATE_OPTIONS,
  COURSE_OPTIONS,
  GRADE_LEVEL_OPTIONS,
} from "@/types/family";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Home,
  User,
  X,
  MapPin,
  Copy,
  Printer,
} from "lucide-react";
import styles from "./family-form.module.css";
import { FamilyImageUploader } from "@/components/FamilyImageUploader";

interface FamilyFormPageProps {
  mode: "create" | "edit";
  familyId?: string;
}

const familyFormSchema = z
  .object({
    visitedDate: z.string().min(1, "Visited date is required"),
    memberStatus: z.enum(["visit", "member", "pending"]),
    phoneNumber: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    familyNotes: z.string().optional(),
    familyPicture: z.string().optional(),
    supportTeamMember: z.string().optional(),
    husband: z.object({
      koreanName: z.string().optional(),
      englishName: z.string().optional(),
      birthDate: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      courses: z.array(z.string()),
    }),
    wife: z.object({
      koreanName: z.string().optional(),
      englishName: z.string().optional(),
      birthDate: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      courses: z.array(z.string()),
    }),
    children: z.array(
      z.object({
        koreanName: z.string().optional(),
        englishName: z.string().optional(),
        birthDate: z.string().optional(),
        gradeLevel: z.string().optional(),
        school: z.string().optional(),
      }),
    ),
  })
  .refine(
    (data) => {
      // Family name is effectively required through the auto-generation logic
      // At least one spouse's Korean name is needed to generate family name
      const hasHusbandName =
        data.husband.koreanName && data.husband.koreanName.trim().length > 0;
      const hasWifeName =
        data.wife.koreanName && data.wife.koreanName.trim().length > 0;
      return hasHusbandName || hasWifeName;
    },
    {
      message:
        "Family name cannot be generated without at least one spouse's Korean name",
      path: ["husband", "koreanName"],
    },
  );

type FormData = z.infer<typeof familyFormSchema>;

const isValidDatePart = (year: string, month: string, day: string): boolean => {
  if (year.length === 4) {
    const yearNum = parseInt(year);
    if (yearNum < 1950 || yearNum > 2050) return false;
  }
  
  if (month.length === 2) {
    const monthNum = parseInt(month);
    if (monthNum < 1 || monthNum > 12) return false;
  }
  
  if (day.length === 2) {
    const dayNum = parseInt(day);
    if (dayNum < 1 || dayNum > 31) return false;
    
    if (month.length === 2) {
      const monthNum = parseInt(month);
      const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (dayNum > daysInMonth[monthNum - 1]) return false;
      
      if (monthNum === 2 && dayNum > 28 && year.length === 4) {
        const yearNum = parseInt(year);
        const isLeapYear = (yearNum % 4 === 0 && yearNum % 100 !== 0) || (yearNum % 400 === 0);
        if (!isLeapYear && dayNum > 28) return false;
        if (isLeapYear && dayNum > 29) return false;
      }
    }
  }
  
  return true;
};

const formatBirthDate = (input: string): string => {
  const digitsOnly = input.replace(/\D/g, '').slice(0, 8);
  
  if (digitsOnly.length <= 4) {
    const year = digitsOnly;
    if (!isValidDatePart(year, '', '')) return input.replace(/\D/g, '').slice(0, -1);
    return digitsOnly;
  } else if (digitsOnly.length <= 6) {
    const year = digitsOnly.slice(0, 4);
    const month = digitsOnly.slice(4);
    if (!isValidDatePart(year, month, '')) return input.replace(/\D/g, '').slice(0, -1);
    return `${year}-${month}`;
  } else {
    const year = digitsOnly.slice(0, 4);
    const month = digitsOnly.slice(4, 6);
    const day = digitsOnly.slice(6);
    if (!isValidDatePart(year, month, day)) return input.replace(/\D/g, '').slice(0, -1);
    return `${year}-${month}-${day}`;
  }
};

const handleBirthDateChange = (value: string, onChange: (value: string) => void) => {
  const formatted = formatBirthDate(value);
  onChange(formatted);
};

const handleChildBirthDateChange = (value: string, onChange: (value: string) => void, childIndex: number, form: any) => {
  const formatted = formatBirthDate(value);
  onChange(formatted);
  
  // Auto-calculate grade level if birthdate is complete (YYYY-MM-DD format)
  if (formatted.length === 10) {
    const calculatedGrade = calculateGradeLevelFromBirthdate(formatted);
    if (calculatedGrade) {
      form.setValue(`children.${childIndex}.gradeLevel`, calculatedGrade);
    }
  }
};

export default function FamilyFormPage({
  mode,
  familyId,
}: FamilyFormPageProps) {
  const [, setLocation] = useLocation();
  const { user, canAddDelete } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [autoGeneratedValues, setAutoGeneratedValues] = useState({
    familyName: "",
    fullAddress: "",
    gradeGroups: {} as Record<number, string>,
  });

  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeChildTab, setActiveChildTab] = useState("child-0");
  const [activeTab, setActiveTab] = useState("husband");

  const form = useForm<FormData>({
    resolver: zodResolver(familyFormSchema),
    defaultValues: {
      visitedDate: mode === "create" ? formatDateForInput(getPreviousSunday(new Date())) : "",
      memberStatus: "visit",
      phoneNumber: "",
      email: "",
      address: "",
      city: "Frisco",
      state: "TX",
      zipCode: "",
      familyNotes: "",
      familyPicture: "",
      supportTeamMember: "",
      husband: {
        koreanName: "",
        englishName: "",
        birthDate: "",
        phoneNumber: "",
        email: "",
        courses: [],
      },
      wife: {
        koreanName: "",
        englishName: "",
        birthDate: "",
        phoneNumber: "",
        email: "",
        courses: [],
      },
      children: [
        {
          koreanName: "",
          englishName: "",
          birthDate: "",
          gradeLevel: "",
          school: "",
        },
      ],
    },
  });

  const { data: family, isLoading } = useQuery<FamilyWithMembers>({
    queryKey: ["families", familyId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/families/${familyId}`);
      return response.json();
    },
    enabled: mode === "edit" && !!familyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const familyData = {
        familyName: autoGeneratedValues.familyName,
        fullAddress: autoGeneratedValues.fullAddress,
        visitedDate: data.visitedDate,
        memberStatus: data.memberStatus,
        phoneNumber: data.phoneNumber,
        email: data.email || undefined,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        familyNotes: data.familyNotes || undefined,
        familyPicture: data.familyPicture || undefined,
        supportTeamMember: data.supportTeamMember || undefined,
      };

      const members = [
        {
          ...data.husband,
          relationship: "husband" as const,
          email: data.husband.email || undefined,
          phoneNumber: data.husband.phoneNumber || undefined,
          birthDate: data.husband.birthDate || undefined,
        },
        {
          ...data.wife,
          relationship: "wife" as const,
          email: data.wife.email || undefined,
          phoneNumber: data.wife.phoneNumber || undefined,
          birthDate: data.wife.birthDate || undefined,
        },
        ...data.children.map((child) => ({
          ...child,
          relationship: "child" as const,
          birthDate: child.birthDate || undefined,
          gradeLevel: child.gradeLevel || undefined,
          gradeGroup:
            autoGeneratedValues.gradeGroups[data.children.indexOf(child)] ||
            undefined,
          school: child.school || undefined,
          courses: [],
          phoneNumber: undefined,
          email: undefined,
        })),
      ];

      if (mode === "create") {
        return await apiRequest("POST", "/api/families", {
          ...familyData,
          members,
        });
      } else {
        return await apiRequest("PUT", `/api/families/${familyId}`, {
          ...familyData,
          members,
        });
      }
    },
    onSuccess: () => {
      // Invalidate all family-related queries
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.refetchQueries({ queryKey: ["families"] });
      toast({
        title: "Success",
        description:
          mode === "create"
            ? "Family created successfully."
            : "Family updated successfully.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode} family.`,
        variant: "destructive",
      });
    },
  });

  // Load family data for edit mode
  useEffect(() => {
    if (mode === "edit" && family) {
      const husband = family.members.find((m) => m.relationship === "husband");
      const wife = family.members.find((m) => m.relationship === "wife");
      const children = family.members.filter((m) => m.relationship === "child");

      form.reset({
        visitedDate: family.visitedDate || formatDateForInput(getPreviousSunday(new Date())),
        memberStatus: family.memberStatus as any,
        phoneNumber: family.phoneNumber,
        email: family.email || "",
        address: family.address,
        city: family.city,
        state: family.state,
        zipCode: family.zipCode,
        familyNotes: family.familyNotes || "",
        familyPicture: family.familyPicture || "",
        supportTeamMember: family.supportTeamMember || "",
        husband: husband
          ? {
              koreanName: husband.koreanName,
              englishName: husband.englishName,
              birthDate: husband.birthDate || "",
              phoneNumber: husband.phoneNumber || "",
              email: husband.email || "",
              courses: husband.courses || [],
            }
          : form.getValues("husband"),
        wife: wife
          ? {
              koreanName: wife.koreanName,
              englishName: wife.englishName,
              birthDate: wife.birthDate || "",
              phoneNumber: wife.phoneNumber || "",
              email: wife.email || "",
              courses: wife.courses || [],
            }
          : form.getValues("wife"),
        children:
          children.length > 0
            ? children.map((child) => ({
                koreanName: child.koreanName,
                englishName: child.englishName,
                birthDate: child.birthDate || "",
                gradeLevel: child.gradeLevel || "",
                school: child.school || "",
              }))
            : form.getValues("children"),
      });

      // Set picture preview if there's an existing family picture
      if (family.familyPicture) {
        setPicturePreview(family.familyPicture);
      }
    }
  }, [family, mode, form]);

  // Auto-generate family name
  useEffect(() => {
    const subscription = form.watch((value) => {
      const familyName = generateFamilyName(
        value.husband?.koreanName || "",
        value.wife?.koreanName || "",
      );

      const fullAddress = generateFullAddress(
        value.address || "",
        value.city || "",
        value.state || "",
        value.zipCode || "",
      );

      const gradeGroups: Record<number, string> = {};
      value.children?.forEach((child, index) => {
        if (child?.gradeLevel) {
          gradeGroups[index] = getGradeGroup(child.gradeLevel);
        }
      });

      setAutoGeneratedValues({ familyName, fullAddress, gradeGroups });
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const addChild = () => {
    const currentChildren = form.getValues("children");
    const newChildIndex = currentChildren.length;
    form.setValue("children", [
      ...currentChildren,
      {
        koreanName: "",
        englishName: "",
        birthDate: "",
        gradeLevel: "",
        school: "",
      },
    ]);
    // Switch to the new child tab
    setActiveChildTab(`child-${newChildIndex}`);
  };

  const removeChild = (index: number) => {
    const currentChildren = form.getValues("children");
    if (currentChildren.length > 1) {
      form.setValue(
        "children",
        currentChildren.filter((_, i) => i !== index),
      );

      // Handle tab switching after removal
      const currentTabIndex = parseInt(activeChildTab.split('-')[1]);
      if (currentTabIndex === index) {
        // If removing the current tab, switch to the previous tab (or first if removing the first)
        const newTabIndex = index > 0 ? index - 1 : 0;
        setActiveChildTab(`child-${newTabIndex}`);
      } else if (currentTabIndex > index) {
        // If removing a tab before the current one, adjust the current tab index
        setActiveChildTab(`child-${currentTabIndex - 1}`);
      }
    }
  };

  const handlePhoneFormat = (value: string, fieldName: string) => {
    const formatted = formatPhoneNumber(value);
    form.setValue(fieldName as any, formatted);
  };

  // Helper function to determine who should have courses (husband priority)
  const getCoursesPrimaryPerson = () => {
    const husbandKoreanName = form.watch("husband.koreanName");
    const husbandEnglishName = form.watch("husband.englishName");
    
    // If husband has any name (Korean or English), use husband
    if (husbandKoreanName || husbandEnglishName) {
      return "husband";
    }
    
    // Otherwise, use wife
    return "wife";
  };

  // Function to handle course changes for the primary person
  const handleCourseChange = (courseValue: string, checked: boolean) => {
    const primaryPerson = getCoursesPrimaryPerson();
    const currentCourses = form.getValues(`${primaryPerson}.courses`) || [];
    
    if (checked) {
      form.setValue(`${primaryPerson}.courses`, [...currentCourses, courseValue]);
    } else {
      form.setValue(`${primaryPerson}.courses`, currentCourses.filter(c => c !== courseValue));
    }
    
    // Clear courses from the other person
    const otherPerson = primaryPerson === "husband" ? "wife" : "husband";
    form.setValue(`${otherPerson}.courses`, []);
  };

  const handleImageUpload = (imageUrl: string) => {
    form.setValue("familyPicture", imageUrl);
    setPicturePreview(imageUrl);
  };

  const handleRemoveImage = () => {
    form.setValue("familyPicture", "");
    setPicturePreview(null);
  };

  const onSubmit = (data: FormData) => {
    // Check permissions before attempting to save
    if (mode === "create" && !canAddDelete) {
      toast({
        title: "Permission Error",
        description: "You don't have permission to create families. Admin access required.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(data);
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!familyId) throw new Error("No family ID");
      return await apiRequest("DELETE", `/api/families/${familyId}`);
    },
    onSuccess: () => {
      // Invalidate all family-related queries
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.refetchQueries({ queryKey: ["families"] });
      toast({
        title: "Success",
        description: "Family deleted successfully.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete family.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    setShowDeleteDialog(false);
    deleteMutation.mutate();
  };

  const printFormalDocument = () => {
    const formData = form.getValues();
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const husband = formData.husband;
    const wife = formData.wife;
    const children = formData.children || [];
    
    const printContent = `
      <html>
        <head>
          <title>Official Family Registration Form - ${autoGeneratedValues.familyName}</title>
          <style>
            @page {
              size: A4;
              margin: 0.75in;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.4;
              color: #000;
              margin: 0;
              padding: 0;
              background: white;
            }
            .document-header {
              text-align: center;
              border-bottom: 3px solid #000;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .document-title {
              font-size: 24pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 8px;
            }
            .document-subtitle {
              font-size: 14pt;
              color: #333;
              margin-bottom: 15px;
            }
            .reference-number {
              font-size: 11pt;
              text-align: right;
              margin-bottom: 10px;
              color: #666;
            }
            .section {
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 16pt;
              font-weight: bold;
              text-transform: uppercase;
              background: #f0f0f0;
              padding: 12px;
              border: 2px solid #000;
              margin-bottom: 15px;
              text-align: center;
              letter-spacing: 1px;
            }
            .form-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .form-grid.single {
              grid-template-columns: 1fr;
            }
            .field-group {
              border: 1px solid #333;
              padding: 15px;
              background: #fafafa;
            }
            .field-label {
              font-weight: bold;
              text-transform: uppercase;
              font-size: 10pt;
              color: #333;
              margin-bottom: 5px;
              display: block;
            }
            .field-value {
              font-size: 12pt;
              border-bottom: 1px solid #333;
              min-height: 20px;
              padding: 3px 0;
              display: block;
            }
            .field-value.empty {
              border-bottom: 1px solid #333;
              height: 20px;
            }
            .checkbox-field {
              display: flex;
              align-items: center;
              margin: 8px 0;
            }
            .checkbox {
              width: 15px;
              height: 15px;
              border: 2px solid #000;
              margin-right: 10px;
              position: relative;
            }
            .checkbox.checked::after {
              content: "✓";
              position: absolute;
              top: -3px;
              left: 1px;
              font-size: 14px;
              font-weight: bold;
            }
            .member-card {
              border: 2px solid #000;
              margin-bottom: 15px;
              background: white;
            }
            .member-header {
              background: #e0e0e0;
              padding: 10px;
              font-weight: bold;
              font-size: 14pt;
              text-align: center;
              text-transform: uppercase;
            }
            .member-details {
              padding: 15px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            .member-details.children {
              grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
            }
            .notes-section {
              border: 2px solid #000;
              padding: 15px;
              margin-top: 20px;
              min-height: 120px;
            }
            .notes-title {
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 10px;
              border-bottom: 1px solid #333;
              padding-bottom: 5px;
            }
            .signature-section {
              margin-top: 40px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 50px;
            }
            .signature-block {
              text-align: center;
              border-top: 2px solid #000;
              padding-top: 10px;
            }
            .signature-line {
              border-bottom: 2px solid #000;
              height: 50px;
              margin-bottom: 10px;
            }
            .date-line {
              border-bottom: 1px solid #333;
              height: 25px;
              margin: 10px 0;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              font-size: 10pt;
              color: #666;
              border-top: 1px solid #ccc;
              padding-top: 15px;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="reference-number">
            Form Reference: FAM-REG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}
          </div>
          
          <div class="document-header">
            <div class="document-title">Official Family Registration</div>
            <div class="document-subtitle">Church Member Information System</div>
            <div style="font-size: 11pt; margin-top: 10px;">Date: ${today}</div>
          </div>

          <div class="section">
            <div class="section-title">Family Information</div>
            <div class="form-grid">
              <div class="field-group">
                <label class="field-label">Family Name</label>
                <span class="field-value">${autoGeneratedValues.familyName || ''}</span>
              </div>
              <div class="field-group">
                <label class="field-label">Visit Date</label>
                <span class="field-value">${formData.visitedDate || ''}</span>
              </div>
            </div>
            <div class="form-grid">
              <div class="field-group">
                <label class="field-label">Support Team Member</label>
                <span class="field-value">${formData.supportTeamMember || ''}</span>
              </div>
              <div class="field-group">
                <label class="field-label">Member Status</label>
                <div style="margin-top: 8px;">
                  <div class="checkbox-field">
                    <div class="checkbox ${formData.memberStatus === 'visit' ? 'checked' : ''}"></div>
                    <span>방문 (Visit)</span>
                  </div>
                  <div class="checkbox-field">
                    <div class="checkbox ${formData.memberStatus === 'member' ? 'checked' : ''}"></div>
                    <span>등록 (Member)</span>
                  </div>
                  <div class="checkbox-field">
                    <div class="checkbox ${formData.memberStatus === 'pending' ? 'checked' : ''}"></div>
                    <span>미정 (Pending)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          ${husband ? `
          <div class="section">
            <div class="member-card">
              <div class="member-header">Husband Information</div>
              <div class="member-details">
                <div class="field-group">
                  <label class="field-label">Name</label>
                  <span class="field-value">${husband.koreanName || husband.englishName || ''}</span>
                </div>
                <div class="field-group">
                  <label class="field-label">Birth Date</label>
                  <span class="field-value">${husband.birthDate || ''}</span>
                </div>
                <div class="field-group">
                  <label class="field-label">Phone Number</label>
                  <span class="field-value">${husband.phoneNumber || ''}</span>
                </div>
                <div class="field-group">
                  <label class="field-label">Email</label>
                  <span class="field-value">${husband.email || ''}</span>
                </div>
              </div>
            </div>
          </div>
          ` : ''}

          ${wife ? `
          <div class="section">
            <div class="member-card">
              <div class="member-header">Wife Information</div>
              <div class="member-details">
                <div class="field-group">
                  <label class="field-label">Name</label>
                  <span class="field-value">${wife.koreanName || wife.englishName || ''}</span>
                </div>
                <div class="field-group">
                  <label class="field-label">Birth Date</label>
                  <span class="field-value">${wife.birthDate || ''}</span>
                </div>
                <div class="field-group">
                  <label class="field-label">Phone Number</label>
                  <span class="field-value">${wife.phoneNumber || ''}</span>
                </div>
                <div class="field-group">
                  <label class="field-label">Email</label>
                  <span class="field-value">${wife.email || ''}</span>
                </div>
              </div>
            </div>
          </div>
          ` : ''}

          ${children.length > 0 ? `
          <div class="section">
            <div class="section-title">Children Information</div>
            ${children.map((child: any, index: number) => `
              <div class="member-card">
                <div class="member-header">Child #${index + 1}</div>
                <div class="member-details children">
                  <div class="field-group">
                    <label class="field-label">Name</label>
                    <span class="field-value">${child.koreanName || child.englishName || ''}</span>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Birth Date</label>
                    <span class="field-value">${child.birthDate || ''}</span>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Grade Level</label>
                    <span class="field-value">${child.gradeLevel || ''}</span>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Grade Group</label>
                    <span class="field-value">${child.gradeGroup || ''}</span>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Email</label>
                    <span class="field-value">${child.email || ''}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Address Information</div>
            <div class="form-grid">
              <div class="field-group">
                <label class="field-label">Street Address</label>
                <span class="field-value">${formData.address || ''}</span>
              </div>
              <div class="field-group">
                <label class="field-label">City</label>
                <span class="field-value">${formData.city || ''}</span>
              </div>
            </div>
            <div class="form-grid">
              <div class="field-group">
                <label class="field-label">State</label>
                <span class="field-value">${formData.state || ''}</span>
              </div>
              <div class="field-group">
                <label class="field-label">ZIP Code</label>
                <span class="field-value">${formData.zipCode || ''}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="notes-section">
              <div class="notes-title">Family Notes</div>
              <div style="white-space: pre-wrap; min-height: 80px;">${formData.familyNotes || ''}</div>
            </div>
          </div>

          <div class="signature-section">
            <div>
              <div class="signature-line"></div>
              <div><strong>Family Representative Signature</strong></div>
              <div class="date-line" style="margin-top: 20px;"></div>
              <div>Date</div>
            </div>
            <div>
              <div class="signature-line"></div>
              <div><strong>Church Staff Signature</strong></div>
              <div class="date-line" style="margin-top: 20px;"></div>
              <div>Date</div>
            </div>
          </div>

          <div class="footer">
            <div><strong>For Office Use Only</strong></div>
            <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; text-align: left;">
              <div>
                <div style="border-bottom: 1px solid #333; height: 25px; margin-bottom: 5px;"></div>
                <small>Processed By</small>
              </div>
              <div>
                <div style="border-bottom: 1px solid #333; height: 25px; margin-bottom: 5px;"></div>
                <small>Date Processed</small>
              </div>
              <div>
                <div style="border-bottom: 1px solid #333; height: 25px; margin-bottom: 5px;"></div>
                <small>Reference Number</small>
              </div>
            </div>
            <div style="margin-top: 30px; font-size: 9pt; color: #999;">
              This document contains confidential information. Handle in accordance with privacy policies.
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  if (mode === "edit" && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading family data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Navigation Header */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLeft}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className={styles.backButton}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />Back
            </Button>
            <h1 className={styles.navTitle}>
              {autoGeneratedValues.familyName}
            </h1>
          </div>

          <div className={styles.navRight}>
  {mode === "create" ? "New" : "Edit"} 
          </div>
        </div>
      </nav>

      {/* Form Content */}
      <div className={styles.main}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Fixed Tabs Header */}
              <div className="sticky top-0 z-40 bg-white border-b shadow-sm mb-4">
                <div className="max-w-4xl mx-auto px-4 py-2">
                  <TabsList className="grid w-full grid-cols-6 gap-1 h-12 sm:h-auto py-2 bg-gray-100 rounded-lg border shadow-sm">
                    <TabsTrigger className="text-xs font-medium px-1 rounded-md bg-white/50 hover:bg-white border-0 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all" value="husband">남편</TabsTrigger>
                    <TabsTrigger className="text-xs font-medium px-1 rounded-md bg-white/50 hover:bg-white border-0 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all" value="wife">아내</TabsTrigger>
                    <TabsTrigger className="text-xs font-medium px-1 rounded-md bg-white/50 hover:bg-white border-0 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all" value="children">자녀</TabsTrigger>
                    <TabsTrigger className="text-xs font-medium px-1 rounded-md bg-white/50 hover:bg-white border-0 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all" value="address">주소</TabsTrigger>
                    <TabsTrigger className="text-xs font-medium px-1 rounded-md bg-white/50 hover:bg-white border-0 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all" value="picture">사진</TabsTrigger>
                    <TabsTrigger className="text-xs font-medium px-1 rounded-md bg-white/50 hover:bg-white border-0 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all" value="basic">추가</TabsTrigger>
                  </TabsList>
                </div>
              </div>
              <TabsContent value="basic">
                {/* Basic Family Information */}
                <Card>
                  <CardContent className={styles.sectionContent}>
                    <div className={styles.grid}>
                      <div>
                        

                      </div>
                      
                      <div>
                        <FormField
                          control={form.control}
                          name="visitedDate"
                          render={({ field }) => (
                            <FormItem>
                             
                              <FormControl>
                                <SundayDatePicker
                                  {...field}
                                  data-testid="input-visited-date"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="memberStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>방문/등록</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-member-status">
                                  <SelectValue placeholder="Select status..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MEMBER_STATUS_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="supportTeamMember"
                        render={({ field }) => (
                          <FormItem>
                         
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="섬김이"
                                data-testid="input-support-team"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="picture">
                {/* Family Picture Section */}
                <Card>
                  <CardHeader>
                    <h2 className={styles.sectionTitle}>
                      <Home className="w-5 h-5 mr-2 text-primary" />
                      Family Picture
                    </h2>
                  </CardHeader>
                  <CardContent className={styles.sectionContent}>
                    <div className="flex justify-center">
                      <FormField
                        control={form.control}
                        name="familyPicture"
                        render={() => (
                          <FormItem>
                            <FormLabel>Picture</FormLabel>
                            <FormControl>
                              <div className="space-y-4">
                                <FamilyImageUploader
                                  currentImage={picturePreview || undefined}
                                  onUploadComplete={handleImageUpload}
                                />
                                
                                {picturePreview && (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleRemoveImage}
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Remove Picture
                                  </Button>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="basic">

              </TabsContent>

              <TabsContent value="husband">
                {/* Husband Section */}
                <Card>

              <CardContent className={styles.sectionContent}>
                <div className={styles.grid}>
                  <FormField
                    control={form.control}
                    name="husband.koreanName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>남편이름</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder=""
                            data-testid="input-husband-korean-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="husband.phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>전화번호(10자리 숫자만 입력, 자동포맷)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="(555) 123-4567"
                                                          type="text"
                                      
                            onChange={(e) =>
                              handlePhoneFormat(
                                e.target.value,
                                "husband.phoneNumber",
                              )
                            }
                            data-testid="input-husband-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <FormField
                    control={form.control}
                    name="husband.birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>생일(8자리 숫자만 입력) 등록시만 필요</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                              type="text"
                                       maxLength={10}
                            placeholder="예: 2012년 3월 8일, 20120308"
                       
                            onChange={(e) => handleBirthDateChange(e.target.value, field.onChange)}
                            data-testid="input-husband-birth-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <div className={styles.fullWidth}>
                    <FormField
                      control={form.control}
                      name="husband.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email(필수사항아님)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="john.kim@example.com"
                              data-testid="input-husband-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wife">
                {/* Wife Section */}
                <Card>

              <CardContent className={styles.sectionContent}>
                <div className={styles.grid}>
                  <FormField
                    control={form.control}
                    name="wife.koreanName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>아내이름</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
  
                            data-testid="input-wife-korean-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="wife.phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>전화번호(10자리 숫자만 입력, 자동포맷)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="(555) 123-4568"
                              type="text"
                                     
                                      
                            onChange={(e) =>
                              handlePhoneFormat(
                                e.target.value,
                                "wife.phoneNumber",
                              )
                            }
                            data-testid="input-wife-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="wife.birthDate"
                    render={({ field }) => (
                      <FormItem>
                         <FormLabel>생일(8자리 숫자만 입력) 등록시만 필요</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            
                            type="text"
                                       
                            placeholder="예: 2012년 3월 8일, 20120308"
                            maxLength={10}
                            onChange={(e) => handleBirthDateChange(e.target.value, field.onChange)}
                            data-testid="input-wife-birth-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <div className={styles.fullWidth}>
                    <FormField
                      control={form.control}
                      name="wife.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email(필수사항아님)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="jane.kim@example.com"
                              data-testid="input-wife-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                </div>
              </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="children">
                {/* Children Section */}
                <Card>
                  <CardContent className={styles.sectionContent}>
                    <Tabs value={activeChildTab} onValueChange={setActiveChildTab} className="w-full">
                      <div className="flex items-center justify-between mb-4">
                        <TabsList className="flex-1 mr-4">
                          {form.watch("children").map((_, index) => (
                            <TabsTrigger key={index} value={`child-${index}`} className="text-sm">
                              Child {index + 1}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addChild}
                          data-testid="button-add-child"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Child
                        </Button>
                      </div>

                      {form.watch("children").map((_, index) => (
                        <TabsContent key={index} value={`child-${index}`} className="mt-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold">Child {index + 1}</h3>
                              {form.watch("children").length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeChild(index)}
                                  className="text-destructive hover:text-destructive/80"
                                  data-testid={`button-remove-child-${index}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Remove
                                </Button>
                              )}
                            </div>

                            <div className={styles.grid}>
                              <FormField
                                control={form.control}
                                name={`children.${index}.koreanName`}
                                render={({ field }) => (
                                  <FormItem>
                                   
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="한글이름"
                                        data-testid={`input-child-${index}-korean-name`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`children.${index}.englishName`}
                                render={({ field }) => (
                                  <FormItem>
                               
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="English Name"
                                        data-testid={`input-child-${index}-english-name`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`children.${index}.birthDate`}
                                render={({ field }) => (
                                  <FormItem>
                              
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="text"
                                   
                           
                                        placeholder="생일 (e.g., 20100708)"
                                        maxLength={10}
                                        onChange={(e) => handleChildBirthDateChange(e.target.value, field.onChange, index, form)}
                                        data-testid={`input-child-${index}-birth-date`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`children.${index}.gradeLevel`}
                                render={({ field }) => (
                                  <FormItem>
                                   
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger
                                          data-testid={`select-child-${index}-grade-level`}
                                        >
                                          <SelectValue placeholder="Select Grade..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {GRADE_LEVEL_OPTIONS.map((option) => (
                                          <SelectItem
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div className="space-y-2">
                             
                                <div className="p-2 bg-muted rounded-md text-sm">
                                  {autoGeneratedValues.gradeGroups[index] || ""}
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="address">
                {/* Address Section */}
                <Card>

                  <CardContent className={styles.sectionContent}>
                    {/* Full Address Display */}
                    {autoGeneratedValues.fullAddress && (
                      <div className="mb-6 p-3 bg-muted rounded-md">
   
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-medium text-foreground flex-1">
                            {autoGeneratedValues.fullAddress}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(autoGeneratedValues.fullAddress);
                              toast({
                                description: "Address copied to clipboard",
                              });
                            }}
                            className="text-primary hover:text-primary/80"
                            title="Copy address"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const printWindow = window.open('', '_blank');
                              if (printWindow) {
                                printWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>Address Label</title>
                                      <style>
                                        @page {
                                          size: 2.63in 0.98in;
                                          margin: 0;
                                        }
                                        body {
                                          margin: 0;
                                          padding: 8px;
                                          font-family: Arial, sans-serif;
                                          font-size: 10px;
                                          line-height: 1.2;
                                          width: 2.63in;
                                          height: 0.98in;
                                          box-sizing: border-box;
                                          display: flex;
                                          align-items: center;
                                          justify-content: center;
                                          text-align: center;
                                          word-wrap: break-word;
                                          overflow: hidden;
                                        }
                                        .address {
                                          max-width: 100%;
                                          max-height: 100%;
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="address">${autoGeneratedValues.fullAddress}</div>
                                    </body>
                                  </html>
                                `);
                                printWindow.document.close();
                                printWindow.print();
                                printWindow.close();
                              }
                            }}
                            className="text-primary hover:text-primary/80"
                            title="Print address label"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const encodedAddress = encodeURIComponent(autoGeneratedValues.fullAddress);
                              window.open(`https://maps.google.com/maps?q=${encodedAddress}`, '_blank');
                            }}
                            className="text-primary hover:text-primary/80"
                            title="Open in Google Maps"
                          >
                            <MapPin className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className={styles.grid}>
                      <div className={styles.fullWidth}>
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="주소입력"
                                  data-testid="input-address"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                          
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="City"
                                data-testid="input-city"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                          
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-state">
                                  <SelectValue placeholder="Select state..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {STATE_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                        
                            <FormControl>
                              <Input
                                {...field}
                                 placeholder="zip코드"
                                  type="number"
                                 pattern="[0-9]*"
                    maxLength={5}
                               
                                data-testid="input-zip-code"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>

            {/* Form Actions */}
            <div className={styles.actions}>

                            {mode === "edit" && user?.group === 'ADM' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteMutation.isPending ? "Deleting..." : "X"}
                </Button>
              )}


              <Button
                type="button"
                variant="secondary"
                className="bg-green-500 hover:bg-green-600 text-white mr-4"
                onClick={() => setLocation("/")}
                data-testid="button-cancel"
              >
                Cancel
              </Button>



              
              <Button
                type="submit"
                disabled={saveMutation.isPending || (mode === "create" && !canAddDelete)}
                data-testid="button-save"
                title={mode === "create" && !canAddDelete ? "Admin access required to create families" : ""}
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-family">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Family</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this family? This action cannot be undone and will permanently remove all family information and member records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Family
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
