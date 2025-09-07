import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFamilySchema, insertFamilyMemberSchema, insertStaffSchema, insertAnnouncementSchema, insertEventSchema, insertEventAttendanceSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";

// Session type for staff authentication
declare module "express-session" {
  interface SessionData {
    staffId?: string;
    staffGroup?: string;
  }
}

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      session: import('express-session').Session & Partial<import('express-session').SessionData>;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize sample staff data
  await initializeSampleData();

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        const filename = `${nanoid()}-${Date.now()}${extension}`;
        cb(null, filename);
      }
    }),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
      }
    }
  });

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.staffId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  const requireAdminAccess = (req: any, res: any, next: any) => {
    if (!req.session?.staffGroup || !['ADM', 'MGM'].includes(req.session.staffGroup)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  const requireSuperAdminAccess = (req: any, res: any, next: any) => {
    if (!req.session?.staffGroup || req.session.staffGroup !== 'ADM') {
      return res.status(403).json({ message: "Super admin access required" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { nickname, pin } = req.body;
      
      if (!nickname || !pin) {
        return res.status(400).json({ message: "Nickname and PIN are required" });
      }

      const staff = await storage.getStaffByNickname(nickname);
      if (!staff || staff.personalPin !== pin) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.staffId = staff.id;
      req.session.staffGroup = staff.group;

      res.json({
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
        group: staff.group
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const staff = await storage.getStaff(req.session.staffId!);
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }

      res.json({
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
        group: staff.group,
        email: staff.email
      });
    } catch (error) {
      console.error("Get staff error:", error);
      res.status(500).json({ message: "Failed to get staff" });
    }
  });

  // User profile update route (users can update their own profile)
  app.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      console.log("Profile update request body:", req.body);
      
      // Users can only update specific fields of their own profile
      const allowedFields = {
        fullName: req.body.fullName,
        nickName: req.body.nickName,
        email: req.body.email,
        personalPin: req.body.personalPin
      };
      
      console.log("Allowed fields:", allowedFields);

      // Remove undefined values (but allow empty strings for email)
      const updateData = Object.fromEntries(
        Object.entries(allowedFields).filter(([key, value]) => {
          if (value === undefined) return false;
          if (key === 'email') return true; // Allow empty email
          if (key === 'personalPin' && value === '') return false; // Don't update PIN if empty
          return value !== '';
        })
      );
      
      console.log("Final update data:", updateData);

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const updatedStaff = await storage.updateStaff(req.session.staffId!, updateData);
      console.log("Updated staff result:", updatedStaff);
      if (!updatedStaff) {
        return res.status(404).json({ message: "Staff not found" });
      }

      // Return updated profile (excluding sensitive data)
      res.json({
        id: updatedStaff.id,
        fullName: updatedStaff.fullName,
        nickName: updatedStaff.nickName,
        group: updatedStaff.group,
        email: updatedStaff.email
      });
    } catch (error) {
      console.error("Update profile error:", error);
      if (error.message?.includes('unique')) {
        return res.status(400).json({ message: "Email or nickname already exists" });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // PIN verification route for viewing secure family notes
  app.post("/api/auth/verify-pin", requireAuth, async (req, res) => {
    try {
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({ success: false, message: "PIN is required" });
      }

      // Get the current staff member to verify against their PIN
      const staff = await storage.getStaff(req.session.staffId!);
      if (!staff) {
        return res.status(404).json({ success: false, message: "Staff not found" });
      }

      // Verify the PIN matches the staff's PIN
      if (staff.personalPin === pin) {
        res.json({ success: true });
      } else {
        res.json({ success: false, message: "Invalid PIN" });
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      res.status(500).json({ success: false, message: "Failed to verify PIN" });
    }
  });

  // Staff routes
  app.get("/api/staff", async (req, res) => {
    try {
      const staff = await storage.getAllActiveStaff();
      res.json(staff.map(s => ({
        id: s.id,
        fullName: s.fullName,
        nickName: s.nickName,
        group: s.group
      })));
    } catch (error) {
      console.error("Get staff error:", error);
      res.status(500).json({ message: "Failed to get staff" });
    }
  });

  // Staff management routes (ADM only)
  app.get("/api/staff/manage", requireAuth, requireSuperAdminAccess, async (req, res) => {
    try {
      const allStaff = await storage.getAllStaffForManagement();
      res.json(allStaff);
    } catch (error) {
      console.error("Get staff management error:", error);
      res.status(500).json({ message: "Failed to get staff for management" });
    }
  });

  app.post("/api/staff/manage", requireAuth, requireSuperAdminAccess, async (req, res) => {
    try {
      const staffData = insertStaffSchema.parse(req.body);
      const newStaff = await storage.createStaff(staffData);
      res.json(newStaff);
    } catch (error) {
      console.error("Create staff error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      if (error.message?.includes('unique')) {
        return res.status(400).json({ message: "Nickname already exists" });
      }
      res.status(500).json({ message: "Failed to create staff" });
    }
  });

  app.put("/api/staff/manage/:id", requireAuth, requireSuperAdminAccess, async (req, res) => {
    try {
      const staffData = insertStaffSchema.partial().parse(req.body);
      const updatedStaff = await storage.updateStaff(req.params.id, staffData);
      if (!updatedStaff) {
        return res.status(404).json({ message: "Staff not found" });
      }
      res.json(updatedStaff);
    } catch (error) {
      console.error("Update staff error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      if (error.message?.includes('unique')) {
        return res.status(400).json({ message: "Nickname already exists" });
      }
      res.status(500).json({ message: "Failed to update staff" });
    }
  });

  app.delete("/api/staff/manage/:id", requireAuth, requireSuperAdminAccess, async (req, res) => {
    try {
      // Don't allow deleting yourself
      if (req.params.id === req.session.staffId) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      
      await storage.deleteStaff(req.params.id);
      res.json({ message: "Staff deleted successfully" });
    } catch (error) {
      console.error("Delete staff error:", error);
      res.status(500).json({ message: "Failed to delete staff" });
    }
  });

  // Object storage upload URL endpoint
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Object storage file update endpoint
  app.put("/api/family-images", requireAuth, async (req, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.imageURL,
        {
          owner: req.session?.staffId || "system",
          // Family images are public so they can be viewed by all staff
          visibility: "public",
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting family image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve objects from object storage
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Legacy file upload route (keeping for backward compatibility)
  app.post("/api/upload", requireAuth, (req, res) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
          }
        }
        return res.status(400).json({ message: err.message || "Upload failed" });
      }

      try {
        if (!req.file) {
          console.log("No file in request");
          return res.status(400).json({ message: "No file uploaded" });
        }

        console.log("File uploaded successfully:", req.file.filename);
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({ url: imageUrl });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ message: "Failed to upload file" });
      }
    });
  });

  // Serve uploaded files statically
  app.use('/uploads', (req, res, next) => {
    // Add CORS headers for image requests
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // Family routes
  app.get("/api/families", requireAuth, async (req, res) => {
    try {
      const filters = {
        name: req.query.name as string,
        lifeGroup: req.query.lifeGroup as string,
        supportTeamMember: req.query.supportTeamMember as string,
        memberStatus: req.query.memberStatus as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        courses: req.query.courses as string,
      };

      // Remove undefined values
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      );

      const families = await storage.getFamilies(cleanFilters);
      res.json(families);
    } catch (error) {
      console.error("Get families error:", error);
      res.status(500).json({ message: "Failed to get families" });
    }
  });

  app.get("/api/families/:id", requireAuth, async (req, res) => {
    try {
      const family = await storage.getFamily(req.params.id);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      res.json(family);
    } catch (error) {
      console.error("Get family error:", error);
      res.status(500).json({ message: "Failed to get family" });
    }
  });

  app.post("/api/families", requireAuth, requireAdminAccess, async (req, res) => {
    try {
      // For family creation, members don't have familyId yet
      const memberSchemaForCreation = insertFamilyMemberSchema.omit({ familyId: true });
      const familySchema = insertFamilySchema.extend({
        members: z.array(memberSchemaForCreation)
      });

      const { members, ...familyData } = familySchema.parse(req.body);
      
      const family = await storage.createFamily(familyData, members);
      res.json(family);
    } catch (error) {
      console.error("Create family error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create family" });
    }
  });

  app.put("/api/families/:id", requireAuth, async (req, res) => {
    try {
      // For family updates, members might not have familyId (will be added by storage)
      const memberSchemaForUpdate = insertFamilyMemberSchema.omit({ familyId: true });
      const familySchema = insertFamilySchema.extend({
        members: z.array(memberSchemaForUpdate)
      }).partial();

      const { members, ...familyData } = familySchema.parse(req.body);
      
      const family = await storage.updateFamily(req.params.id, familyData, members || []);
      res.json(family);
    } catch (error) {
      console.error("Update family error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update family" });
    }
  });

  app.delete("/api/families/:id", requireAuth, requireAdminAccess, async (req, res) => {
    try {
      await storage.deleteFamily(req.params.id);
      res.json({ message: "Family deleted" });
    } catch (error) {
      console.error("Delete family error:", error);
      res.status(500).json({ message: "Failed to delete family" });
    }
  });

  // Public announcement route (no authentication required)
  app.get("/api/announcements/public/:id", async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      
      // Only return the announcement if it's not login-required
      if (announcement.isLoginRequired) {
        return res.status(403).json({ message: "Announcement requires authentication" });
      }
      
      res.json(announcement);
    } catch (error) {
      console.error("Get public announcement error:", error);
      res.status(500).json({ message: "Failed to get announcement" });
    }
  });

  // Announcement routes
  app.get("/api/announcements", requireAuth, async (req, res) => {
    try {
      const announcements = await storage.getAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Get announcements error:", error);
      res.status(500).json({ message: "Failed to get announcements" });
    }
  });

  app.get("/api/announcements/active", async (req, res) => {
    try {
      const announcements = await storage.getActiveAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Get active announcements error:", error);
      res.status(500).json({ message: "Failed to get active announcements" });
    }
  });

  app.get("/api/announcements/login", async (req, res) => {
    try {
      const announcements = await storage.getLoginPageAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Get login announcements error:", error);
      res.status(500).json({ message: "Failed to get login announcements" });
    }
  });

  app.get("/api/announcements/dashboard", requireAuth, async (req, res) => {
    try {
      const announcements = await storage.getDashboardAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Get dashboard announcements error:", error);
      res.status(500).json({ message: "Failed to get dashboard announcements" });
    }
  });

  app.get("/api/announcements/:id", requireAuth, async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      res.json(announcement);
    } catch (error) {
      console.error("Get announcement error:", error);
      res.status(500).json({ message: "Failed to get announcement" });
    }
  });

  app.post("/api/announcements", requireAuth, requireSuperAdminAccess, async (req, res) => {
    try {
      const announcementData = insertAnnouncementSchema.parse({
        ...req.body,
        createdBy: req.session.staffId
      });
      const announcement = await storage.createAnnouncement(announcementData);
      res.json(announcement);
    } catch (error) {
      console.error("Create announcement error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  app.put("/api/announcements/:id", requireAuth, requireSuperAdminAccess, async (req, res) => {
    try {
      const announcementData = insertAnnouncementSchema.partial().parse(req.body);
      const updatedAnnouncement = await storage.updateAnnouncement(req.params.id, announcementData);
      if (!updatedAnnouncement) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      res.json(updatedAnnouncement);
    } catch (error) {
      console.error("Update announcement error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update announcement" });
    }
  });

  app.delete("/api/announcements/:id", requireAuth, requireSuperAdminAccess, async (req, res) => {
    try {
      await storage.deleteAnnouncement(req.params.id);
      res.json({ message: "Announcement deleted successfully" });
    } catch (error) {
      console.error("Delete announcement error:", error);
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  // Care log routes
  app.get("/api/families/:familyId/care-logs", requireAuth, async (req, res) => {
    try {
      const careLogs = await storage.getCareLogsForFamily(req.params.familyId);
      res.json(careLogs);
    } catch (error) {
      console.error("Get care logs error:", error);
      res.status(500).json({ message: "Failed to get care logs" });
    }
  });

  app.get("/api/care-logs/:id", requireAuth, async (req, res) => {
    try {
      const careLog = await storage.getCareLog(req.params.id);
      if (!careLog) {
        return res.status(404).json({ message: "Care log not found" });
      }
      res.json(careLog);
    } catch (error) {
      console.error("Get care log error:", error);
      res.status(500).json({ message: "Failed to get care log" });
    }
  });

  app.post("/api/care-logs", requireAuth, async (req, res) => {
    try {
      const careLogData = {
        familyId: req.body.familyId,
        staffId: req.session.staffId!, // Auto-assign to current user
        date: req.body.date,
        type: req.body.type,
        description: req.body.description,
        status: req.body.status,
      };

      const careLog = await storage.createCareLog(careLogData);
      res.json(careLog);
    } catch (error) {
      console.error("Create care log error:", error);
      res.status(500).json({ message: "Failed to create care log" });
    }
  });

  // Permission middleware for care log updates/deletes
  const requireCareLogOwnerOrAdmin = async (req: any, res: any, next: any) => {
    try {
      const careLog = await storage.getCareLog(req.params.id);
      if (!careLog) {
        return res.status(404).json({ message: "Care log not found" });
      }

      // Allow if user is ADM group or if they're the original staff member who created the log
      if (req.session.staffGroup === 'ADM' || careLog.staffId === req.session.staffId) {
        req.careLog = careLog; // Pass care log to next handler
        return next();
      }

      return res.status(403).json({ message: "Permission denied. Only ADM group or the original staff member can modify care logs." });
    } catch (error) {
      console.error("Care log permission check error:", error);
      res.status(500).json({ message: "Failed to check permissions" });
    }
  };

  app.put("/api/care-logs/:id", requireAuth, requireCareLogOwnerOrAdmin, async (req, res) => {
    try {
      const careLogData = {
        date: req.body.date,
        type: req.body.type,
        description: req.body.description,
        status: req.body.status,
      };

      const updatedCareLog = await storage.updateCareLog(req.params.id, careLogData);
      if (!updatedCareLog) {
        return res.status(404).json({ message: "Care log not found" });
      }
      res.json(updatedCareLog);
    } catch (error) {
      console.error("Update care log error:", error);
      res.status(500).json({ message: "Failed to update care log" });
    }
  });

  app.delete("/api/care-logs/:id", requireAuth, requireCareLogOwnerOrAdmin, async (req, res) => {
    try {
      await storage.deleteCareLog(req.params.id);
      res.json({ message: "Care log deleted" });
    } catch (error) {
      console.error("Delete care log error:", error);
      res.status(500).json({ message: "Failed to delete care log" });
    }
  });

  // Event routes
  app.get("/api/events", requireAuth, async (req, res) => {
    try {
      const events = req.query.active === 'true' ? await storage.getActiveEvents() : await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error("Get events error:", error);
      res.status(500).json({ message: "Failed to get events" });
    }
  });

  app.get("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Get event error:", error);
      res.status(500).json({ message: "Failed to get event" });
    }
  });

  app.post("/api/events", requireAuth, requireAdminAccess, async (req, res) => {
    try {
      const eventData = insertEventSchema.parse({
        ...req.body,
        createdBy: req.session.staffId
      });
      const event = await storage.createEvent(eventData);
      
      // Initialize attendance for all families
      await storage.initializeEventAttendance(event.id, req.session.staffId!);
      
      res.json(event);
    } catch (error) {
      console.error("Create event error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.put("/api/events/:id", requireAuth, requireAdminAccess, async (req, res) => {
    try {
      const eventData = insertEventSchema.partial().parse(req.body);
      const updatedEvent = await storage.updateEvent(req.params.id, eventData);
      if (!updatedEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(updatedEvent);
    } catch (error) {
      console.error("Update event error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", requireAuth, requireAdminAccess, async (req, res) => {
    try {
      await storage.deleteEvent(req.params.id);
      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Event attendance routes
  app.get("/api/events/:eventId/attendance", requireAuth, async (req, res) => {
    try {
      const attendance = await storage.getEventAttendance(req.params.eventId);
      res.json(attendance);
    } catch (error) {
      console.error("Get event attendance error:", error);
      res.status(500).json({ message: "Failed to get event attendance" });
    }
  });

  // Permission middleware for attendance updates
  const requireAttendanceUpdatePermission = async (req: any, res: any, next: any) => {
    try {
      // ADM and MGM can update all attendance
      if (req.session.staffGroup === 'ADM' || req.session.staffGroup === 'MGM') {
        return next();
      }

      // For non-admin users, implement family-specific permissions
      // This is a placeholder for when family-staff relationships are implemented
      // For now, we'll restrict non-admin users to only view attendance
      return res.status(403).json({ 
        message: "Permission denied. Only administrators can update attendance records." 
      });
    } catch (error) {
      console.error("Attendance permission check error:", error);
      res.status(500).json({ message: "Failed to check permissions" });
    }
  };

  app.put("/api/attendance/:id", requireAuth, requireAttendanceUpdatePermission, async (req, res) => {
    try {
      const attendanceData = insertEventAttendanceSchema.partial().parse({
        ...req.body,
        updatedBy: req.session.staffId
      });
      
      const updatedAttendance = await storage.updateEventAttendance(req.params.id, attendanceData);
      if (!updatedAttendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      res.json(updatedAttendance);
    } catch (error) {
      console.error("Update attendance error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update attendance" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function initializeSampleData() {
  try {
    const existingStaff = await storage.getAllActiveStaff();
    if (existingStaff.length === 0) {
      // Create sample staff
      await storage.createStaff({
        fullName: "John Admin",
        nickName: "John",
        personalPin: "1234",
        group: "ADM",
        displayOrder: 1
      });

      await storage.createStaff({
        fullName: "Sarah Manager",
        nickName: "Sarah",
        personalPin: "2345",
        group: "MGM",
        displayOrder: 2
      });

      await storage.createStaff({
        fullName: "Mike Team A",
        nickName: "Mike",
        personalPin: "3456",
        group: "TEAM-A",
        displayOrder: 3
      });

      await storage.createStaff({
        fullName: "Lisa Team B",
        nickName: "Lisa",
        personalPin: "4567",
        group: "TEAM-B",
        displayOrder: 4
      });

      console.log("Sample staff data initialized");
    }
  } catch (error) {
    console.error("Failed to initialize sample data:", error);
  }
}
