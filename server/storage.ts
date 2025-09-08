import { 
  staff, 
  families, 
  familyMembers,
  careLogs,
  announcements,
  events,
  eventAttendance,
  type Staff, 
  type InsertStaff,
  type Family,
  type InsertFamily,
  type FamilyMember,
  type InsertFamilyMember,
  type FamilyWithMembers,
  type CareLog,
  type InsertCareLog,
  type CareLogWithStaff,
  type Announcement,
  type InsertAnnouncement,
  type AnnouncementWithStaff,
  type Event,
  type InsertEvent,
  type EventWithStaff,
  type EventWithAttendance,
  type EventAttendance,
  type InsertEventAttendance,
  type EventAttendanceWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, gte, lte, desc, isNotNull } from "drizzle-orm";

// Generate the next sequential family code
async function generateUniqueFamilyCode(): Promise<string> {
  // Get the highest existing family code number
  const existingFamilies = await db.select({ familyCode: families.familyCode })
    .from(families)
    .where(isNotNull(families.familyCode));
  
  let maxNumber = 0;
  
  // Extract numbers from existing family codes
  for (const family of existingFamilies) {
    if (family.familyCode && family.familyCode.startsWith('FM')) {
      const numberPart = family.familyCode.substring(2);
      const num = parseInt(numberPart, 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }
  
  // Generate next sequential number
  const nextNumber = maxNumber + 1;
  return `FM${nextNumber.toString().padStart(4, '0')}`;
}

export interface IStorage {
  // Staff operations
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffByNickname(nickname: string): Promise<Staff | undefined>;
  getAllActiveStaff(): Promise<Staff[]>;
  getAllStaffForManagement(): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, staff: Partial<InsertStaff>): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<void>;
  
  // Family operations
  getFamily(id: string): Promise<FamilyWithMembers | undefined>;
  getFamilies(filters?: {
    name?: string;
    lifeGroup?: string;
    supportTeamMember?: string;
    memberStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    courses?: string;
  }): Promise<FamilyWithMembers[]>;
  createFamily(family: InsertFamily, members: InsertFamilyMember[]): Promise<FamilyWithMembers>;
  updateFamily(id: string, family: Partial<InsertFamily>, members: InsertFamilyMember[]): Promise<FamilyWithMembers>;
  updateFamilyOnly(id: string, family: Partial<InsertFamily>): Promise<FamilyWithMembers>;
  deleteFamily(id: string): Promise<void>;
  
  // Care log operations
  getCareLog(id: string): Promise<CareLog | undefined>;
  getCareLogsForFamily(familyId: string): Promise<CareLogWithStaff[]>;
  createCareLog(careLog: InsertCareLog): Promise<CareLog>;
  updateCareLog(id: string, careLog: Partial<InsertCareLog>): Promise<CareLog | undefined>;
  deleteCareLog(id: string): Promise<void>;
  
  // Announcement operations
  getAnnouncement(id: string): Promise<AnnouncementWithStaff | undefined>;
  getAnnouncements(): Promise<AnnouncementWithStaff[]>;
  getActiveAnnouncements(): Promise<AnnouncementWithStaff[]>;
  getLoginPageAnnouncements(): Promise<AnnouncementWithStaff[]>;
  getDashboardAnnouncements(): Promise<AnnouncementWithStaff[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: string, announcement: Partial<InsertAnnouncement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: string): Promise<void>;
  
  // Event operations
  getEvent(id: string): Promise<EventWithAttendance | undefined>;
  getEvents(): Promise<EventWithStaff[]>;
  getActiveEvents(): Promise<EventWithStaff[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<void>;
  
  // Event attendance operations
  getEventAttendance(eventId: string): Promise<EventAttendanceWithDetails[]>;
  createEventAttendance(attendance: InsertEventAttendance): Promise<EventAttendance>;
  updateEventAttendance(id: string, attendance: Partial<InsertEventAttendance>): Promise<EventAttendance | undefined>;
  deleteEventAttendance(id: string): Promise<void>;
  initializeEventAttendance(eventId: string, createdBy: string): Promise<void>;
}

// Helper function to clean date fields - convert empty strings to null for optional fields only
function cleanDateFields(data: any): any {
  const cleaned = { ...data };
  
  // Handle optional date fields - convert empty strings to null
  if (cleaned.birthDate === '') cleaned.birthDate = null;
  if (cleaned.registrationDate === '') cleaned.registrationDate = null;
  
  // visitedDate is required, so don't convert to null
  // The form validation should ensure visitedDate is provided
  
  return cleaned;
}

export class DatabaseStorage implements IStorage {
  // Staff operations
  async getStaff(id: string): Promise<Staff | undefined> {
    const [staffMember] = await db.select().from(staff).where(eq(staff.id, id));
    return staffMember || undefined;
  }

  async getStaffByNickname(nickname: string): Promise<Staff | undefined> {
    const [staffMember] = await db.select().from(staff).where(
      and(eq(staff.nickName, nickname), eq(staff.isActive, true))
    );
    return staffMember || undefined;
  }

  async getAllActiveStaff(): Promise<Staff[]> {
    return await db.select().from(staff)
      .where(eq(staff.isActive, true))
      .orderBy(staff.displayOrder, staff.fullName);
  }

  async getAllStaffForManagement(): Promise<Staff[]> {
    return await db.select().from(staff)
      .orderBy(staff.displayOrder, staff.fullName);
  }

  async createStaff(staffData: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(staffData).returning();
    return newStaff;
  }

  async updateStaff(id: string, staffData: Partial<InsertStaff>): Promise<Staff | undefined> {
    const [updatedStaff] = await db.update(staff)
      .set({ ...staffData, updatedAt: new Date() })
      .where(eq(staff.id, id))
      .returning();
    return updatedStaff || undefined;
  }

  async deleteStaff(id: string): Promise<void> {
    // Soft delete by setting isActive to false
    await db.update(staff)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(staff.id, id));
  }

  // Family operations
  async getFamily(id: string): Promise<FamilyWithMembers | undefined> {
    const [family] = await db.select().from(families).where(eq(families.id, id));
    if (!family) return undefined;

    const members = await db.select().from(familyMembers)
      .where(eq(familyMembers.familyId, id))
      .orderBy(familyMembers.relationship);

    return { ...family, members };
  }

  async getFamilies(filters?: {
    name?: string;
    lifeGroup?: string;
    supportTeamMember?: string;
    memberStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    courses?: string;
  }): Promise<FamilyWithMembers[]> {
    const conditions = [];
    
    if (filters?.name) {
      conditions.push(like(families.familyName, `%${filters.name}%`));
    }
    
    if (filters?.lifeGroup) {
      conditions.push(like(families.lifeGroup, `%${filters.lifeGroup}%`));
    }
    
    if (filters?.supportTeamMember) {
      conditions.push(like(families.supportTeamMember, `%${filters.supportTeamMember}%`));
    }
    
    if (filters?.memberStatus && filters.memberStatus !== 'all') {
      // Handle comma-separated values as OR conditions
      const statusValues = filters.memberStatus.split(',').map(s => s.trim());
      if (statusValues.length === 1) {
        conditions.push(eq(families.memberStatus, statusValues[0]));
      } else {
        conditions.push(or(...statusValues.map(status => eq(families.memberStatus, status))));
      }
    }
    
    if (filters?.dateFrom) {
      conditions.push(gte(families.visitedDate, filters.dateFrom));
    }
    
    if (filters?.dateTo) {
      conditions.push(lte(families.visitedDate, filters.dateTo));
    }
    
    const familyList = conditions.length > 0 
      ? await db.select().from(families).where(and(...conditions)).orderBy(desc(families.visitedDate))
      : await db.select().from(families).orderBy(desc(families.visitedDate));
    
    // Get members for each family
    const familiesWithMembers: FamilyWithMembers[] = [];
    for (const family of familyList) {
      const members = await db.select().from(familyMembers)
        .where(eq(familyMembers.familyId, family.id))
        .orderBy(familyMembers.relationship);
      
      familiesWithMembers.push({ ...family, members });
    }
    
    // Apply courses filtering - show families where NEITHER husband nor wife completed the selected course
    if (filters?.courses) {
      const courseList = filters.courses.split(',').map(c => c.trim());
      
      return familiesWithMembers.filter(family => {
        const husband = family.members.find(m => m.relationship === 'husband');
        const wife = family.members.find(m => m.relationship === 'wife');
        
        // Check if husband has completed any of the selected courses
        const husbandCompleted = husband && husband.courses && husband.courses.length > 0 
          ? courseList.some(course => husband.courses.includes(course))
          : false;
        
        // Check if wife has completed any of the selected courses
        const wifeCompleted = wife && wife.courses && wife.courses.length > 0
          ? courseList.some(course => wife.courses.includes(course))
          : false;
        
        // Return true if NEITHER husband nor wife has completed any of the selected courses
        return !husbandCompleted && !wifeCompleted;
      });
    }
    
    return familiesWithMembers;
  }

  async createFamily(familyData: InsertFamily, members: Omit<InsertFamilyMember, 'familyId'>[]): Promise<FamilyWithMembers> {
    const cleanedFamilyData = cleanDateFields(familyData);
    const familyCode = await generateUniqueFamilyCode();
    const [family] = await db.insert(families).values({
      ...cleanedFamilyData,
      familyCode
    }).returning();
    
    const familyMembersData = members.map(member => {
      const cleanedMember = cleanDateFields(member);
      return {
        ...cleanedMember,
        familyId: family.id,
        courses: (cleanedMember.courses as string[]) || []
      };
    });
    
    const createdMembers = await db.insert(familyMembers)
      .values(familyMembersData)
      .returning();
    
    return { ...family, members: createdMembers };
  }

  async updateFamily(id: string, familyData: Partial<InsertFamily>, members: Omit<InsertFamilyMember, 'familyId'>[]): Promise<FamilyWithMembers> {
    const cleanedFamilyData = cleanDateFields(familyData);
    const [family] = await db.update(families)
      .set({ ...cleanedFamilyData, updatedAt: new Date() })
      .where(eq(families.id, id))
      .returning();
    
    // Delete existing members
    await db.delete(familyMembers).where(eq(familyMembers.familyId, id));
    
    // Insert new members
    const familyMembersData = members.map(member => {
      const cleanedMember = cleanDateFields(member);
      return {
        ...cleanedMember,
        familyId: id,
        courses: (cleanedMember.courses as string[]) || []
      };
    });
    
    const updatedMembers = await db.insert(familyMembers)
      .values(familyMembersData)
      .returning();
    
    return { ...family, members: updatedMembers };
  }

  async updateFamilyOnly(id: string, familyData: Partial<InsertFamily>): Promise<FamilyWithMembers> {
    const cleanedFamilyData = cleanDateFields(familyData);
    const [family] = await db.update(families)
      .set({ ...cleanedFamilyData, updatedAt: new Date() })
      .where(eq(families.id, id))
      .returning();
    
    // Get existing members without modifying them
    const existingMembers = await db.select()
      .from(familyMembers)
      .where(eq(familyMembers.familyId, id));
    
    return { ...family, members: existingMembers };
  }

  async deleteFamily(id: string): Promise<void> {
    await db.delete(families).where(eq(families.id, id));
  }

  // Care log operations
  async getCareLog(id: string): Promise<CareLog | undefined> {
    const [careLog] = await db.select().from(careLogs).where(eq(careLogs.id, id));
    return careLog || undefined;
  }

  async getCareLogsForFamily(familyId: string): Promise<CareLogWithStaff[]> {
    const results = await db.select({
      id: careLogs.id,
      familyId: careLogs.familyId,
      staffId: careLogs.staffId,
      date: careLogs.date,
      type: careLogs.type,
      description: careLogs.description,
      status: careLogs.status,
      createdAt: careLogs.createdAt,
      updatedAt: careLogs.updatedAt,
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(careLogs)
    .innerJoin(staff, eq(careLogs.staffId, staff.id))
    .where(eq(careLogs.familyId, familyId))
    .orderBy(desc(careLogs.date), desc(careLogs.createdAt));

    return results as CareLogWithStaff[];
  }

  async createCareLog(careLogData: InsertCareLog): Promise<CareLog> {
    const [newCareLog] = await db.insert(careLogs).values(careLogData).returning();
    return newCareLog;
  }

  async updateCareLog(id: string, careLogData: Partial<InsertCareLog>): Promise<CareLog | undefined> {
    const [updatedCareLog] = await db.update(careLogs)
      .set({ ...careLogData, updatedAt: new Date() })
      .where(eq(careLogs.id, id))
      .returning();
    return updatedCareLog || undefined;
  }

  async deleteCareLog(id: string): Promise<void> {
    await db.delete(careLogs).where(eq(careLogs.id, id));
  }

  // Announcement operations
  async getAnnouncement(id: string): Promise<AnnouncementWithStaff | undefined> {
    const result = await db.select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      type: announcements.type,
      isLoginRequired: announcements.isLoginRequired,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
      createdBy: announcements.createdBy,
      isActive: announcements.isActive,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      createdByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(announcements)
    .innerJoin(staff, eq(announcements.createdBy, staff.id))
    .where(eq(announcements.id, id))
    .limit(1);

    return result[0] as AnnouncementWithStaff || undefined;
  }

  async getAnnouncements(): Promise<AnnouncementWithStaff[]> {
    const results = await db.select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      type: announcements.type,
      isLoginRequired: announcements.isLoginRequired,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
      createdBy: announcements.createdBy,
      isActive: announcements.isActive,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      createdByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(announcements)
    .innerJoin(staff, eq(announcements.createdBy, staff.id))
    .orderBy(desc(announcements.createdAt));

    return results as AnnouncementWithStaff[];
  }

  async getActiveAnnouncements(): Promise<AnnouncementWithStaff[]> {
    const now = new Date();
    const results = await db.select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      type: announcements.type,
      isLoginRequired: announcements.isLoginRequired,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
      createdBy: announcements.createdBy,
      isActive: announcements.isActive,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      createdByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(announcements)
    .innerJoin(staff, eq(announcements.createdBy, staff.id))
    .where(and(
      eq(announcements.isActive, true),
      lte(announcements.startDate, now),
      gte(announcements.endDate, now)
    ))
    .orderBy(desc(announcements.createdAt));

    return results as AnnouncementWithStaff[];
  }

  async getLoginPageAnnouncements(): Promise<AnnouncementWithStaff[]> {
    const now = new Date();
    const results = await db.select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      type: announcements.type,
      isLoginRequired: announcements.isLoginRequired,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
      createdBy: announcements.createdBy,
      isActive: announcements.isActive,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      createdByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(announcements)
    .innerJoin(staff, eq(announcements.createdBy, staff.id))
    .where(and(
      eq(announcements.isActive, true),
      eq(announcements.isLoginRequired, false), // Changed: false = show before login
      lte(announcements.startDate, now),
      gte(announcements.endDate, now)
    ))
    .orderBy(desc(announcements.createdAt));

    return results as AnnouncementWithStaff[];
  }

  async getDashboardAnnouncements(): Promise<AnnouncementWithStaff[]> {
    const now = new Date();
    const results = await db.select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      type: announcements.type,
      isLoginRequired: announcements.isLoginRequired,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
      createdBy: announcements.createdBy,
      isActive: announcements.isActive,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      createdByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(announcements)
    .innerJoin(staff, eq(announcements.createdBy, staff.id))
    .where(and(
      eq(announcements.isActive, true),
      eq(announcements.isLoginRequired, true), // Changed: true = show after login
      lte(announcements.startDate, now),
      gte(announcements.endDate, now)
    ))
    .orderBy(desc(announcements.createdAt));

    return results as AnnouncementWithStaff[];
  }

  async createAnnouncement(announcementData: InsertAnnouncement): Promise<Announcement> {
    const [newAnnouncement] = await db.insert(announcements).values(announcementData).returning();
    return newAnnouncement;
  }

  async updateAnnouncement(id: string, announcementData: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const [updatedAnnouncement] = await db.update(announcements)
      .set({ ...announcementData, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    return updatedAnnouncement || undefined;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  // Event operations
  async getEvent(id: string): Promise<EventWithAttendance | undefined> {
    const eventResult = await db.select({
      id: events.id,
      title: events.title,
      date: events.date,
      time: events.time,
      location: events.location,
      isActive: events.isActive,
      createdBy: events.createdBy,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      createdByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(events)
    .innerJoin(staff, eq(events.createdBy, staff.id))
    .where(eq(events.id, id))
    .limit(1);

    if (!eventResult[0]) return undefined;

    const attendanceResult = await db.select({
      id: eventAttendance.id,
      eventId: eventAttendance.eventId,
      familyId: eventAttendance.familyId,
      familyMemberId: eventAttendance.familyMemberId,
      attendanceStatus: eventAttendance.attendanceStatus,
      updatedBy: eventAttendance.updatedBy,
      createdAt: eventAttendance.createdAt,
      updatedAt: eventAttendance.updatedAt,
      family: {
        id: families.id,
        familyName: families.familyName,
      },
      familyMember: {
        id: familyMembers.id,
        koreanName: familyMembers.koreanName,
        englishName: familyMembers.englishName,
        relationship: familyMembers.relationship,
        gradeGroup: familyMembers.gradeGroup,
      }
    })
    .from(eventAttendance)
    .innerJoin(families, eq(eventAttendance.familyId, families.id))
    .leftJoin(familyMembers, eq(eventAttendance.familyMemberId, familyMembers.id))
    .where(eq(eventAttendance.eventId, id));

    return {
      ...eventResult[0],
      attendance: attendanceResult.map(a => ({
        ...a,
        familyMember: a.familyMember && a.familyMember.id ? a.familyMember : undefined
      }))
    } as EventWithAttendance;
  }

  async getEvents(): Promise<EventWithStaff[]> {
    const results = await db.select({
      id: events.id,
      title: events.title,
      date: events.date,
      time: events.time,
      location: events.location,
      isActive: events.isActive,
      createdBy: events.createdBy,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      createdByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(events)
    .innerJoin(staff, eq(events.createdBy, staff.id))
    .orderBy(desc(events.date));

    return results as EventWithStaff[];
  }

  async getActiveEvents(): Promise<EventWithStaff[]> {
    const results = await db.select({
      id: events.id,
      title: events.title,
      date: events.date,
      time: events.time,
      location: events.location,
      isActive: events.isActive,
      createdBy: events.createdBy,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      createdByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(events)
    .innerJoin(staff, eq(events.createdBy, staff.id))
    .where(eq(events.isActive, true))
    .orderBy(desc(events.date));

    return results as EventWithStaff[];
  }

  async createEvent(eventData: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(eventData).returning();
    return newEvent;
  }

  async updateEvent(id: string, eventData: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updatedEvent] = await db.update(events)
      .set({ ...eventData, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return updatedEvent || undefined;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // Event attendance operations
  async getEventAttendance(eventId: string): Promise<EventAttendanceWithDetails[]> {
    const results = await db.select({
      id: eventAttendance.id,
      eventId: eventAttendance.eventId,
      familyId: eventAttendance.familyId,
      familyMemberId: eventAttendance.familyMemberId,
      attendanceStatus: eventAttendance.attendanceStatus,
      updatedBy: eventAttendance.updatedBy,
      createdAt: eventAttendance.createdAt,
      updatedAt: eventAttendance.updatedAt,
      event: {
        id: events.id,
        title: events.title,
        date: events.date,
        time: events.time,
        location: events.location,
        isActive: events.isActive,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      },
      family: {
        id: families.id,
        familyName: families.familyName,
        supportTeamMember: families.supportTeamMember,
      },
      familyMember: {
        id: familyMembers.id,
        koreanName: familyMembers.koreanName,
        englishName: familyMembers.englishName,
        relationship: familyMembers.relationship,
        gradeGroup: familyMembers.gradeGroup,
      },
      updatedByStaff: {
        id: staff.id,
        fullName: staff.fullName,
        nickName: staff.nickName,
      }
    })
    .from(eventAttendance)
    .innerJoin(events, eq(eventAttendance.eventId, events.id))
    .innerJoin(families, eq(eventAttendance.familyId, families.id))
    .leftJoin(familyMembers, eq(eventAttendance.familyMemberId, familyMembers.id))
    .innerJoin(staff, eq(eventAttendance.updatedBy, staff.id))
    .where(eq(eventAttendance.eventId, eventId))
    .orderBy(families.familyName);

    return results.map(r => ({
      ...r,
      familyMember: r.familyMember && r.familyMember.id ? r.familyMember : undefined
    })) as EventAttendanceWithDetails[];
  }

  async createEventAttendance(attendanceData: InsertEventAttendance): Promise<EventAttendance> {
    const [newAttendance] = await db.insert(eventAttendance).values(attendanceData).returning();
    return newAttendance;
  }

  async updateEventAttendance(id: string, attendanceData: Partial<InsertEventAttendance>): Promise<EventAttendance | undefined> {
    const [updatedAttendance] = await db.update(eventAttendance)
      .set({ ...attendanceData, updatedAt: new Date() })
      .where(eq(eventAttendance.id, id))
      .returning();
    return updatedAttendance || undefined;
  }

  async deleteEventAttendance(id: string): Promise<void> {
    await db.delete(eventAttendance).where(eq(eventAttendance.id, id));
  }

  async initializeEventAttendance(eventId: string, createdBy: string): Promise<void> {
    // Get all families with their members
    const allFamilies = await db.select({
      id: families.id,
      familyName: families.familyName,
    }).from(families);

    const allFamilyMembers = await db.select({
      id: familyMembers.id,
      familyId: familyMembers.familyId,
      koreanName: familyMembers.koreanName,
      englishName: familyMembers.englishName,
      relationship: familyMembers.relationship,
      gradeGroup: familyMembers.gradeGroup,
    }).from(familyMembers);

    const attendanceRecords = [];

    // Create attendance records for each family member
    for (const family of allFamilies) {
      const members = allFamilyMembers.filter(member => member.familyId === family.id);
      
      // Filter out members without names (skip empty koreanName and englishName)
      const namedMembers = members.filter(member => 
        (member.koreanName && member.koreanName.trim() !== '') || 
        (member.englishName && member.englishName.trim() !== '')
      );
      
      if (namedMembers.length > 0) {
        // Create individual records for each named family member
        for (const member of namedMembers) {
          attendanceRecords.push({
            eventId: eventId,
            familyId: family.id,
            familyMemberId: member.id,
            attendanceStatus: 'pending' as const,
            updatedBy: createdBy
          });
        }
      } else {
        // If no named family members, create a family-level record
        attendanceRecords.push({
          eventId: eventId,
          familyId: family.id,
          attendanceStatus: 'pending' as const,
          updatedBy: createdBy
        });
      }
    }

    if (attendanceRecords.length > 0) {
      await db.insert(eventAttendance).values(attendanceRecords);
    }
  }
}

export const storage = new DatabaseStorage();
