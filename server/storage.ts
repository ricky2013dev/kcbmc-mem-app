import { 
  staff, 
  families, 
  familyMembers,
  careLogs,
  announcements,
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
  type AnnouncementWithStaff
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
  }): Promise<FamilyWithMembers[]>;
  createFamily(family: InsertFamily, members: InsertFamilyMember[]): Promise<FamilyWithMembers>;
  updateFamily(id: string, family: Partial<InsertFamily>, members: InsertFamilyMember[]): Promise<FamilyWithMembers>;
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
}

export const storage = new DatabaseStorage();
