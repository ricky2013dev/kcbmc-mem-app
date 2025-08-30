# Family Management System

## Overview

This is a family registration and management system designed for staff to efficiently register, track, and manage family information and their members. The application features role-based access control where only ADM (Administrator) and MGM (Management) groups can add/delete records, while other staff members can edit existing information. The system includes authentication via nickname and PIN, comprehensive family forms with member details, and advanced search capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development practices
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent, accessible interfaces
- **Styling**: Tailwind CSS with CSS modules for component-specific styles
- **Form Handling**: React Hook Form with Zod validation for robust form management
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API endpoints
- **Language**: TypeScript for full-stack type safety
- **Session Management**: Express sessions with PostgreSQL storage for authentication state
- **API Design**: RESTful endpoints with proper HTTP status codes and error handling
- **Middleware**: Custom authentication and authorization middleware for role-based access control

### Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless hosting for scalability
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **Schema**: Comprehensive data model covering staff, families, and family members with proper relationships
- **Migrations**: Drizzle Kit for database schema versioning and migrations

### Authentication and Authorization
- **Authentication Method**: Nickname and PIN-based login system
- **Session Storage**: Server-side sessions stored in PostgreSQL for persistence
- **Role-Based Access**: Three-tier permission system (ADM/MGM for full access, other groups for edit-only)
- **Security**: Session-based authentication with secure cookie handling

### External Dependencies
- **Database Provider**: Neon Database (PostgreSQL-compatible serverless database)
- **WebSocket Library**: ws package for Neon database connections
- **Development Tools**: Replit-specific plugins for development environment integration
- **UI Framework**: Radix UI for accessible component primitives
- **Validation**: Zod for runtime type checking and form validation
- **Date Handling**: date-fns for date manipulation and formatting
- **Icons**: Lucide React for consistent iconography

### Key Features
- **Staff Management**: Secure login system with role-based permissions
- **Family Registration**: Comprehensive forms for family and member information including Korean/English names, grades, courses, and contact details
- **Search and Filtering**: Advanced search capabilities by family name, life group, support team member, status, and date ranges
- **Grade Management**: Automatic grade group assignment based on predefined grade levels (Sprouts, Dream Kid, Team Kid, Youth levels)
- **Date Validation**: Sunday-only date picker for church-specific scheduling requirements
- **Phone Formatting**: Automatic phone number formatting for consistent data entry
- **Responsive Design**: Mobile-first design approach with adaptive layouts

### Business Logic
- **Grade Groups**: Automatic assignment based on age/grade level (Baby through College/Young Adult)
- **Family Naming**: Auto-generation of family names from husband and wife Korean names
- **Address Handling**: Comprehensive address management with full address concatenation
- **Course Management**: Predefined SDS course options (101, 201, 301, 401)
- **Status Tracking**: Member status management (visit, member, pending)