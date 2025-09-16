# KCMBC Church Management System

## Overview

This is a comprehensive church management system built for KCMBC (Korean Community Baptist Church). The application provides tools for managing families, staff, announcements, events, departments, teams, and care logs. It features role-based access control with different permission levels for administrators, managers, and team leaders.

The system supports family registration and tracking, event management with attendance tracking, announcement publishing, staff authentication, and organizational structure management through departments and teams. It includes file upload capabilities for family photos and rich text editing for announcements and care logs.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Forms**: React Hook Form with Zod validation
- **Rich Text**: ReactQuill for WYSIWYG editing
- **Drag & Drop**: dnd-kit for sortable interfaces
- **File Upload**: Custom implementation with Google Cloud Storage integration

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with type-safe queries
- **Authentication**: Session-based authentication using express-session
- **File Handling**: Multer for multipart form data processing
- **API Design**: RESTful API with consistent JSON responses
- **Development**: Vite for development server and hot module replacement

### Database Schema Design
- **Families & Members**: Hierarchical family structure with support for husband, wife, and children
- **Staff Management**: Role-based staff system with login tracking
- **Events & Attendance**: Event management with attendance tracking capabilities
- **Announcements**: Rich content announcements with staff attribution
- **Care Logs**: Detailed care tracking for families with various interaction types
- **Organization**: Department and team structure for organizing families and staff
- **Audit Trail**: Comprehensive logging of staff activities and family interactions

### Authentication & Authorization
- **Session Management**: Server-side sessions with secure cookie configuration
- **Role-Based Access**: Four-tier access system (ADM, MGM, TEAM-A, TEAM-B)
- **Login Tracking**: Complete audit trail of staff login attempts and activities
- **PIN-Based Authentication**: Secure 4-digit PIN system for staff access

### File Storage & Management
- **Hybrid Storage**: Automatic switching between local storage (development) and object storage (production)
- **Cloud Storage**: Google Cloud Storage integration via Replit sidecar for persistent file storage
- **Object ACL**: Custom access control layer for file permissions
- **Image Processing**: Support for family photos and document uploads
- **Secure Access**: Token-based authentication for file access
- **Production Persistence**: Images persist across deployments when object storage is configured

#### Setting Up Persistent Storage for Production:
To ensure images persist across production deployments, configure these environment variables:
- `STORAGE_BACKEND=object` - Explicitly enable object storage
- `PRIVATE_OBJECT_DIR=/your-bucket-name` - Your App Storage bucket for private files
- `PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket-name/public` - Search paths for public files

Create a bucket in the App Storage tool in your Replit workspace and use that bucket name in the environment variables above.

### Development & Deployment
- **Build System**: Vite for frontend bundling, esbuild for backend compilation
- **Environment**: Separate development and production configurations
- **Database Migrations**: Drizzle Kit for schema management
- **Type Safety**: End-to-end TypeScript coverage with shared types

## External Dependencies

### Database
- **Neon Database**: PostgreSQL-compatible serverless database
- **Connection Pooling**: @neondatabase/serverless for optimized connections

### Cloud Services
- **Google Cloud Storage**: File storage and management
- **Replit Sidecar**: Authentication proxy for Google Cloud services

### UI & Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Quill**: Rich text editor component

### Development Tools
- **Vite**: Frontend build tool and development server
- **Drizzle Kit**: Database schema management and migrations
- **TSX**: TypeScript execution for development
- **PostCSS**: CSS processing with Tailwind integration

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation library
- **@hookform/resolvers**: Integration between React Hook Form and Zod

### Additional Libraries
- **TanStack Query**: Server state management and caching
- **date-fns**: Date manipulation utilities
- **nanoid**: Unique ID generation
- **class-variance-authority**: Type-safe variant management for components