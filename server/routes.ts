import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFamilySchema, insertFamilyMemberSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

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
        group: staff.group
      });
    } catch (error) {
      console.error("Get staff error:", error);
      res.status(500).json({ message: "Failed to get staff" });
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

  // File upload route
  app.post("/api/upload", requireAuth, (req, res) => {
    console.log("Upload route hit", { 
      hasFile: !!req.file, 
      sessionId: req.session?.staffId,
      contentType: req.headers['content-type']
    });
    
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
