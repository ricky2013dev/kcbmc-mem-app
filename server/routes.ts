import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFamilySchema, insertFamilyMemberSchema, insertStaffSchema, insertAnnouncementSchema, insertEventSchema, insertEventAttendanceSchema, insertDepartmentSchema, insertTeamSchema, insertDonationSchema } from "@server/schema";
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
  // Health check endpoints for deployment (moved to /api to avoid interfering with frontend)
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  app.get("/api/status", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Initialize sample staff data
  await initializeSampleData();

  // Configure multer for file uploads (local storage for development)
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

  // Configure multer for CSV file uploads
  const csvUpload = multer({
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
      fileSize: 10 * 1024 * 1024, // 10MB limit for CSV files
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['text/csv', 'application/vnd.ms-excel'];
      const isCSV = allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv');
      if (isCSV) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only CSV files are allowed.'));
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

  const requireManagementAccess = (req: any, res: any, next: any) => {
    if (!req.session?.staffGroup || !['ADM', 'MGM'].includes(req.session.staffGroup)) {
      return res.status(403).json({ message: "Management access required" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const loginTime = new Date();
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    let staffForLogging = null;

    try {
      const { nickname, pin } = req.body;
      
      if (!nickname || !pin) {
        // Log failed attempt with missing credentials
        if (nickname) {
          staffForLogging = await storage.getStaffByNickname(nickname);
        }
        
        if (staffForLogging) {
          await storage.createStaffLoginLog({
            staffId: staffForLogging.id,
            loginTime,
            ipAddress,
            userAgent,
            success: false,
            failureReason: 'Missing credentials',
          });
        }
        
        return res.status(400).json({ message: "Nickname and PIN are required" });
      }

      const staff = await storage.getStaffByNickname(nickname);
      
      if (!staff || staff.personalPin !== pin) {
        // Log failed login attempt
        if (staff) {
          await storage.createStaffLoginLog({
            staffId: staff.id,
            loginTime,
            ipAddress,
            userAgent,
            success: false,
            failureReason: 'Invalid credentials',
          });
        }
        
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Log successful login
      await storage.createStaffLoginLog({
        staffId: staff.id,
        loginTime,
        ipAddress,
        userAgent,
        success: true,
      });

      // Update last login timestamp
      await storage.updateStaff(staff.id, { lastLogin: loginTime });

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
      
      // Log system error if we have staff info
      if (staffForLogging) {
        try {
          await storage.createStaffLoginLog({
            staffId: staffForLogging.id,
            loginTime,
            ipAddress,
            userAgent,
            success: false,
            failureReason: 'System error',
          });
        } catch (logError) {
          console.error("Failed to log login error:", logError);
        }
      }
      
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

  // Staff login log routes
  app.get("/api/staff/:staffId/login-logs", requireAuth, async (req, res) => {
    try {
      // Users can view their own login logs, ADM can view any staff's logs
      if (req.session.staffId !== req.params.staffId && req.session.staffGroup !== 'ADM') {
        return res.status(403).json({ message: "Permission denied" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const loginLogs = await storage.getStaffLoginLogs(req.params.staffId, limit);
      res.json(loginLogs);
    } catch (error) {
      console.error("Get staff login logs error:", error);
      res.status(500).json({ message: "Failed to get login logs" });
    }
  });

  app.get("/api/staff/login-logs/all", requireAuth, requireSuperAdminAccess, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const loginLogs = await storage.getAllStaffLoginLogs(limit);
      res.json(loginLogs);
    } catch (error) {
      console.error("Get all staff login logs error:", error);
      res.status(500).json({ message: "Failed to get all login logs" });
    }
  });

  // Configure multer for cloud storage uploads (memory storage)
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
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

  // Hybrid file upload endpoint (supports both local dev and Replit Object Storage)
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    // Check if Replit Object Storage is configured
    const hasReplitObjectStorage = process.env.PRIVATE_OBJECT_DIR && process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    const useCloudStorage = hasReplitObjectStorage && process.env.NODE_ENV === 'production';

    console.log('Upload request received:', {
      useCloudStorage,
      hasReplitObjectStorage,
      nodeEnv: process.env.NODE_ENV,
      privateObjectDir: process.env.PRIVATE_OBJECT_DIR ? 'SET' : 'NOT_SET',
      publicObjectSearchPaths: process.env.PUBLIC_OBJECT_SEARCH_PATHS ? 'SET' : 'NOT_SET'
    });

    if (useCloudStorage) {
      console.log('Using Replit Object Storage for file upload');
      // Use memory storage for cloud uploads
      memoryUpload.single('file')(req, res, async (err) => {
        if (err) {
          console.error("Multer error for cloud storage:", err);
          return res.status(400).json({ message: `File upload error: ${err.message}` });
        }

        try {
          if (!req.file) {
            console.error("No file found in request");
            return res.status(400).json({ message: "No file uploaded" });
          }

          console.log('File received for cloud upload:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
          });

          // Upload to Google Cloud Storage
          const objectStorageService = new ObjectStorageService();
          const uploadURL = await objectStorageService.getObjectEntityUploadURL();

          console.log('Generated cloud upload URL');

          // Upload file buffer to the cloud
          const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: req.file.buffer,
            headers: {
              'Content-Type': req.file.mimetype,
              'Content-Length': req.file.size.toString(),
            },
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Cloud storage upload failed:', {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              error: errorText
            });
            throw new Error(`Cloud storage upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
          }

          console.log('Successfully uploaded to Replit Object Storage');

          // Extract object path from upload URL for serving
          const fullObjectPath = new URL(uploadURL).pathname;
          const privateObjectDir = objectStorageService.getPrivateObjectDir();

          // Remove the private object directory prefix to get just the relative path
          let relativePath = fullObjectPath;
          if (fullObjectPath.startsWith(privateObjectDir)) {
            relativePath = fullObjectPath.slice(privateObjectDir.length);
            if (relativePath.startsWith('/')) {
              relativePath = relativePath.slice(1);
            }
          }

          const objectPath = `/objects/${relativePath}`;
          console.log('Generated object path:', objectPath);

          res.json({
            uploadURL: objectPath,
            objectPath: objectPath,
            message: 'File uploaded to Replit Object Storage successfully'
          });
        } catch (error: any) {
          console.error("Error uploading to Replit Object Storage:", error);
          res.status(500).json({
            message: `Failed to upload file to Replit Object Storage: ${error.message}`,
            details: error.stack
          });
        }
      });
    } else {
      console.log('Using local storage for file upload (development mode)');
      // Use local disk storage for development
      upload.single('file')(req, res, (err) => {
        if (err) {
          console.error("Multer error for local storage:", err);
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
            }
          }
          return res.status(400).json({ message: `File upload error: ${err.message}` });
        }

        try {
          if (!req.file) {
            console.error("No file found in request");
            return res.status(400).json({ message: "No file uploaded" });
          }

          console.log('File received for local upload:', {
            originalname: req.file.originalname,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
          });

          // Return the local file path that can be used for display
          const filePath = `/uploads/${req.file.filename}`;
          console.log('Generated local file path:', filePath);

          res.json({
            uploadURL: filePath,
            localPath: filePath,
            objectPath: filePath,
            message: 'File uploaded to local storage successfully'
          });
        } catch (error: any) {
          console.error("Error uploading file locally:", error);
          res.status(500).json({
            message: `Failed to upload file locally: ${error.message}`,
            details: error.stack
          });
        }
      });
    }
  });

  // Family image processing endpoint (handles both local and cloud storage)
  app.put("/api/family-images", requireAuth, async (req, res) => {
    if (!req.body.imageURL) {
      console.error("No imageURL provided in request body");
      return res.status(400).json({ error: "imageURL is required" });
    }

    try {
      const imageURL = req.body.imageURL;
      console.log('Processing family image:', { imageURL });

      // Check if we're using cloud storage
      const hasReplitObjectStorage = process.env.PRIVATE_OBJECT_DIR && process.env.PUBLIC_OBJECT_SEARCH_PATHS;
      const useCloudStorage = hasReplitObjectStorage && process.env.NODE_ENV === 'production';

      if (useCloudStorage && imageURL.startsWith('/objects/')) {
        console.log('Processing cloud storage image path');

        // For cloud storage, we might want to set ACL permissions here
        try {
          const objectStorageService = new ObjectStorageService();
          // Normalize the object path and potentially set ACL
          const normalizedPath = objectStorageService.normalizeObjectEntityPath(imageURL);

          console.log('Normalized object path:', normalizedPath);

          res.status(200).json({
            objectPath: normalizedPath,
            message: 'Replit Object Storage image processed successfully'
          });
        } catch (aclError) {
          console.warn('ACL processing failed, but continuing with original path:', aclError);
          // If ACL processing fails, still return the original path
          res.status(200).json({
            objectPath: imageURL,
            message: 'Image processed (ACL warning: ' + (aclError as Error).message + ')'
          });
        }
      } else {
        console.log('Processing local image path');
        // For local files, just return the path as-is
        res.status(200).json({
          objectPath: imageURL,
          message: 'Local image processed successfully'
        });
      }
    } catch (error: any) {
      console.error("Error processing family image:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error.message
      });
    }
  });

  // Serve uploaded files from local storage
  app.get("/uploads/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'uploads', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Serve the file
    res.sendFile(filePath);
  });

  // Replit Object Storage route for serving uploaded files
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const hasReplitObjectStorage = process.env.PRIVATE_OBJECT_DIR && process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    const useCloudStorage = hasReplitObjectStorage && process.env.NODE_ENV === 'production';

    if (!useCloudStorage) {
      // For local development, redirect to local uploads
      const localPath = req.params.objectPath;
      return res.redirect(`/uploads/${localPath}`);
    }

    try {
      console.log("Attempting to serve object:", req.path);

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);

      // If object not found, try alternative path construction
      if (error instanceof ObjectNotFoundError) {
        try {
          // Try with just the filename part for uploaded files
          const filename = req.params.objectPath;
          if (filename && !filename.includes('/')) {
            const alternativePath = `/objects/uploads/${filename}`;
            console.log("Trying alternative path:", alternativePath);

            const objectStorageService = new ObjectStorageService();
            const altObjectFile = await objectStorageService.getObjectEntityFile(alternativePath);
            return objectStorageService.downloadObject(altObjectFile, res);
          }
        } catch (altError) {
          console.error("Alternative path also failed:", altError);
        }

        return res.status(404).json({ error: "File not found" });
      }
      return res.status(500).json({ error: "Internal server error" });
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
        teamId: req.query.teamId as string,
        departmentId: req.query.departmentId as string,
        unassigned: req.query.unassigned === 'true',
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

  // CSV upload endpoint for bulk family creation
  app.post("/api/families/upload-csv", requireAuth, requireSuperAdminAccess, csvUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = fs.readFileSync(req.file.path, 'utf-8');

      // Log first 200 chars for debugging
      console.log('CSV file content (first 200 chars):', fileContent.substring(0, 200));
      console.log('File length:', fileContent.length);

      // Handle different line endings (Windows \r\n, Unix \n, Mac \r)
      const lines = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

      console.log('Total lines found:', lines.length);
      console.log('Header line:', lines[0]);

      if (lines.length < 2) {
        return res.status(400).json({
          message: "CSV file is empty or has only header row",
          debug: {
            totalLines: lines.length,
            fileSize: fileContent.length,
            firstChars: fileContent.substring(0, 100)
          }
        });
      }

      // Skip header row
      const dataLines = lines.slice(1);
      console.log('Data lines to process:', dataLines.length);

      const results = {
        success: 0,
        errors: [] as { row: number; error: string; data: any }[],
        created: {
          departments: [] as string[],
          teams: [] as string[],
          families: [] as string[]
        },
        updated: {
          families: [] as string[]
        }
      };

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        const rowNum = i + 2; // +2 because we skipped header and arrays are 0-indexed
        let fields: string[] = [];

        try {
          // Parse CSV line - split by comma but respect quoted fields
          // This regex handles: "quoted,field",unquoted,field
          const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
          const matches = [];
          let match;

          // Simple split for basic CSV (most common case)
          if (!line.includes('"')) {
            fields = line.split(',').map(f => f.trim());
          } else {
            // Handle quoted fields
            const result = [];
            let current = '';
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
              const char = line[j];

              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            fields = result;
          }

          if (fields.length < 9) {
            throw new Error(`Invalid number of columns. Expected 9, got ${fields.length}. Line content: "${line}"`);
          }

          let [departmentName, teamName, koreanName, englishName, phone, email, address, bizName, bizTitle] = fields;

          // Trim all fields and convert empty strings to undefined
          departmentName = departmentName?.trim();
          teamName = teamName?.trim();
          koreanName = koreanName?.trim();
          englishName = englishName?.trim() || undefined;
          phone = phone?.trim();
          email = email?.trim() || undefined;
          address = address?.trim();
          bizName = bizName?.trim() || undefined;
          bizTitle = bizTitle?.trim() || undefined;

          if (!departmentName || !teamName || !koreanName) {
            throw new Error("Department, Team, and Korean Name are required");
          }

          // Find or create department
          let allDepartments = await storage.getDepartments();
          let department = allDepartments.find(d => d.name.toLowerCase() === departmentName.toLowerCase());

          if (!department) {
            const newDept = await storage.createDepartment({ name: departmentName });
            department = { ...newDept, teams: [] };
            results.created.departments.push(departmentName);
          }

          // Find or create team
          let team = department.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());

          if (!team) {
            team = await storage.createTeam({
              name: teamName,
              departmentId: department.id,
              description: `Auto-created from CSV upload`,
              assignedStaff: []
            });
            results.created.teams.push(teamName);
          }

          // Parse address (assume format: "street, city, state zip" or full address)
          const addressParts = address.split(',').map(p => p.trim());
          let street = address;
          let city = "Frisco";
          let state = "TX";
          let zipCode = "";

          if (addressParts.length >= 2) {
            street = addressParts[0];
            const lastPart = addressParts[addressParts.length - 1];
            const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})/);

            if (stateZipMatch) {
              state = stateZipMatch[1];
              zipCode = stateZipMatch[2];
              if (addressParts.length >= 3) {
                city = addressParts[addressParts.length - 2];
              }
            } else if (addressParts.length >= 2) {
              city = addressParts[1];
            }
          }

          // Use the full Korean name as the family name
          const familyName = koreanName;

          // Check if family already exists in this team
          const existingTeamFamilies = await storage.getTeamFamilies(team.id);
          const existingFamily = existingTeamFamilies.find(f =>
            f.familyName.toLowerCase() === familyName.toLowerCase()
          );

          const familyData = {
            familyName: familyName,
            fullAddress: address,
            visitedDate: new Date().toISOString().split('T')[0],
            memberStatus: 'member' as const,
            phoneNumber: phone,
            email: email,
            address: street,
            city,
            state,
            zipCode,
            teamId: team.id,
            bizName: bizName,
            bizTitle: bizTitle
          };

          console.log('CSV Row:', rowNum, 'Parsed fields:', {
            familyName,
            bizName: `"${bizName}"`,
            bizTitle: `"${bizTitle}"`,
            bizNameType: typeof bizName,
            bizTitleType: typeof bizTitle
          });

          const members = [{
            relationship: 'husband' as const,
            koreanName,
            englishName: englishName || undefined,
            phoneNumber: phone || undefined,
            email: email || undefined,
            courses: []
          }];

          if (existingFamily) {
            // Update existing family
            await storage.updateFamily(existingFamily.id, familyData, members);
            results.updated.families.push(familyName);
            results.success++;
          } else {
            // Create new family
            const family = await storage.createFamily(familyData, members);
            results.created.families.push(family.familyName);
            results.success++;
          }

        } catch (error: any) {
          results.errors.push({
            row: rowNum,
            error: error.message || 'Unknown error',
            data: fields
          });
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json(results);
    } catch (error: any) {
      console.error("CSV upload error:", error);
      res.status(500).json({ message: error.message || "Failed to process CSV" });
    }
  });

  // Quick family member creation endpoint
  app.post("/api/families/quick-member", requireAuth, requireAdminAccess, async (req, res) => {
    try {
      const quickFamilySchema = z.object({
        koreanName: z.string().min(1, "Korean name is required"),
        englishName: z.string().optional(),
        phoneNumber: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        memberType: z.enum(["husband", "wife"]),
        teamId: z.string().min(1, "Team ID is required"),
        familyPicture: z.string().optional()
      });
      
      const data = quickFamilySchema.parse(req.body);
      
      // Get team information to assign support team member
      const team = await storage.getTeam(data.teamId);
      let supportTeamMember = "";
      
      if (team && team.assignedStaff && team.assignedStaff.length > 0) {
        // Get the first assigned staff member as the support team member
        const firstStaffId = team.assignedStaff[0];
        const staffMember = await storage.getStaff(firstStaffId);
        if (staffMember) {
          supportTeamMember = staffMember.fullName;
        }
      }
      
      // Auto-generate family name based on member type and names
      const familyName = data.memberType === "husband" 
        ? `${data.koreanName}`
        : `${data.koreanName}`;
      
      // Create family data with teamId
      const familyData = {
        familyName,
        visitedDate: new Date().toISOString().split('T')[0], // Today's date
        memberStatus: "visit" as const,
        phoneNumber: data.phoneNumber || "",
        email: data.email || "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        fullAddress: "",
        familyNotes: `Quick add from team: ${team?.name || 'Unknown'}. Created on ${new Date().toLocaleDateString()}`,
        supportTeamMember,
        familyPicture: data.familyPicture || "",
        teamId: data.teamId, // Direct assignment to team
      };
      
      // Create family member data
      const memberData = {
        koreanName: data.koreanName,
        englishName: data.englishName || "",
        phoneNumber: data.phoneNumber || "",
        email: data.email || "",
        relationship: data.memberType,
        courses: [],
      };
      
      const family = await storage.createFamily(familyData, [memberData]);
      
      res.json({ 
        success: true, 
        family,
        message: `${data.memberType === "husband" ? "Husband" : "Wife"} and family created successfully`
      });
    } catch (error) {
      console.error("Quick family member creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create family member" });
    }
  });

  app.put("/api/families/:id", requireAuth, async (req, res) => {
    try {
      const { members, ...familyData } = req.body;
      
      // If members are provided, do a full update
      if (members && Array.isArray(members)) {
        // For full family updates, members might not have familyId (will be added by storage)
        const memberSchemaForUpdate = insertFamilyMemberSchema.omit({ familyId: true });
        const familySchema = insertFamilySchema.extend({
          members: z.array(memberSchemaForUpdate)
        }).partial();

        const validatedData = familySchema.parse(req.body);
        const { members: validatedMembers, ...validatedFamilyData } = validatedData;
        
        const family = await storage.updateFamily(req.params.id, validatedFamilyData, validatedMembers || []);
        res.json(family);
      } else {
        // For partial updates (like just family notes), only update family data
        const partialFamilySchema = insertFamilySchema.partial();
        const validatedFamilyData = partialFamilySchema.parse(familyData);
        
        const family = await storage.updateFamilyOnly(req.params.id, validatedFamilyData);
        res.json(family);
      }
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

  // Update family display order within team
  app.put("/api/teams/:teamId/families/order", requireAuth, async (req, res) => {
    try {
      const familyOrderSchema = z.object({
        familyOrders: z.array(z.object({
          id: z.string(),
          displayOrder: z.number()
        }))
      });

      const { familyOrders } = familyOrderSchema.parse(req.body);
      await storage.updateFamilyOrder(req.params.teamId, familyOrders);

      res.json({ success: true, message: "Family order updated successfully" });
    } catch (error) {
      console.error("Update family order error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update family order" });
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

  // Department routes (ADM and MGM access)
  app.get("/api/departments", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Get departments error:", error);
      res.status(500).json({ message: "Failed to get departments" });
    }
  });

  app.get("/api/departments/:id", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      const department = await storage.getDepartment(req.params.id);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      console.error("Get department error:", error);
      res.status(500).json({ message: "Failed to get department" });
    }
  });

  app.post("/api/departments", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      const departmentData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(departmentData);
      res.json(department);
    } catch (error) {
      console.error("Create department error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      if (error.message?.includes('unique')) {
        return res.status(400).json({ message: "Department name already exists" });
      }
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.put("/api/departments/:id", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      const departmentData = insertDepartmentSchema.partial().parse(req.body);
      const updatedDepartment = await storage.updateDepartment(req.params.id, departmentData);
      if (!updatedDepartment) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(updatedDepartment);
    } catch (error) {
      console.error("Update department error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      if (error.message?.includes('unique')) {
        return res.status(400).json({ message: "Department name already exists" });
      }
      res.status(500).json({ message: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      await storage.deleteDepartment(req.params.id);
      res.json({ message: "Department deleted successfully" });
    } catch (error) {
      console.error("Delete department error:", error);
      if (error.message?.includes('foreign key')) {
        return res.status(400).json({ message: "Cannot delete department that has teams. Please delete teams first." });
      }
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // Team routes (ADM and MGM access)
  app.get("/api/teams", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      const departmentId = req.query.departmentId as string;
      if (departmentId) {
        const teams = await storage.getTeamsByDepartment(departmentId);
        res.json(teams);
      } else {
        const teams = await storage.getTeams();
        res.json(teams);
      }
    } catch (error) {
      console.error("Get teams error:", error);
      res.status(500).json({ message: "Failed to get teams" });
    }
  });

  app.get("/api/teams/:id", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Get team error:", error);
      res.status(500).json({ message: "Failed to get team" });
    }
  });

  app.post("/api/teams", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData);
      res.json(team);
    } catch (error) {
      console.error("Create team error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      if (error.message?.includes('foreign key')) {
        return res.status(400).json({ message: "Department not found" });
      }
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.put("/api/teams/:id", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      const teamData = insertTeamSchema.partial().parse(req.body);
      const updatedTeam = await storage.updateTeam(req.params.id, teamData);
      if (!updatedTeam) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(updatedTeam);
    } catch (error) {
      console.error("Update team error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      if (error.message?.includes('foreign key')) {
        return res.status(400).json({ message: "Department not found" });
      }
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAuth, requireManagementAccess, async (req, res) => {
    try {
      await storage.deleteTeam(req.params.id);
      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("Delete team error:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Donation routes
  app.get("/api/donations", requireAuth, async (req, res) => {
    try {
      const filters = {
        familyName: req.query.familyName as string,
        type: req.query.type as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        received: req.query.received as string,
        emailForThank: req.query.emailForThank as string,
        emailForTax: req.query.emailForTax as string,
      };

      // Remove empty filters
      Object.keys(filters).forEach(key => {
        if (!filters[key as keyof typeof filters]) {
          delete filters[key as keyof typeof filters];
        }
      });

      const donations = await storage.getDonations(filters);
      res.json(donations);
    } catch (error) {
      console.error("Get donations error:", error);
      res.status(500).json({ message: "Failed to get donations" });
    }
  });

  app.get("/api/donations/:id", requireAuth, async (req, res) => {
    try {
      const donation = await storage.getDonationById(req.params.id);
      if (!donation) {
        return res.status(404).json({ message: "Donation not found" });
      }
      res.json(donation);
    } catch (error) {
      console.error("Get donation error:", error);
      res.status(500).json({ message: "Failed to get donation" });
    }
  });

  app.post("/api/donations", requireAuth, async (req, res) => {
    try {
      console.log("Creating donation with data:", req.body);
      console.log("Session staff ID:", req.session.staffId);

      // Validate required fields before schema parsing
      if (!req.body.familyId) {
        console.error("Missing familyId");
        return res.status(400).json({ message: "Family must be selected" });
      }

      if (!req.body.amount || parseFloat(req.body.amount) <= 0) {
        console.error("Invalid amount:", req.body.amount);
        return res.status(400).json({ message: "Valid amount is required" });
      }

      if (!req.body.date) {
        console.error("Missing date");
        return res.status(400).json({ message: "Date is required" });
      }

      if (!req.session.staffId) {
        console.error("No staff ID in session");
        return res.status(401).json({ message: "Authentication required" });
      }

      const donationData = insertDonationSchema.parse({
        ...req.body,
        createdBy: req.session.staffId
      });

      console.log("Parsed donation data:", donationData);

      // Verify family exists
      const family = await storage.getFamily(donationData.familyId);
      if (!family) {
        console.error("Family not found:", donationData.familyId);
        return res.status(400).json({ message: "Selected family not found" });
      }

      const donation = await storage.createDonation(donationData);
      console.log("Donation created successfully:", donation.id);
      res.status(201).json(donation);
    } catch (error) {
      console.error("Create donation error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({
          message: "Invalid donation data",
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes('foreign key')) {
        return res.status(400).json({ message: "Invalid family or staff reference" });
      }
      const errorMessage = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to create donation", details: errorMessage });
    }
  });

  app.put("/api/donations/:id", requireAuth, async (req, res) => {
    try {
      const donationData = insertDonationSchema.partial().parse(req.body);
      const donation = await storage.updateDonation(req.params.id, donationData);

      if (!donation) {
        return res.status(404).json({ message: "Donation not found" });
      }

      res.json(donation);
    } catch (error) {
      console.error("Update donation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid donation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update donation" });
    }
  });

  app.delete("/api/donations/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteDonation(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Donation not found" });
      }
      res.json({ message: "Donation deleted successfully" });
    } catch (error) {
      console.error("Delete donation error:", error);
      res.status(500).json({ message: "Failed to delete donation" });
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
