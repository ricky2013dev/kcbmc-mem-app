import { 
  staff, 
  families, 
  familyMembers,
  type Staff, 
  type InsertStaff,
  type Family,
  type InsertFamily,
  type FamilyMember,
  type InsertFamilyMember,
  type FamilyWithMembers
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, gte, lte, desc } from "drizzle-orm";

export interface IStorage {
  // Staff operations
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffByNickname(nickname: string): Promise<Staff | undefined>;
  getAllActiveStaff(): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  
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

  async createStaff(staffData: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(staffData).returning();
    return newStaff;
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
    let query = db.select().from(families);
    
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
    
    if (filters?.memberStatus) {
      conditions.push(eq(families.memberStatus, filters.memberStatus));
    }
    
    if (filters?.dateFrom) {
      conditions.push(gte(families.registrationDate, filters.dateFrom));
    }
    
    if (filters?.dateTo) {
      conditions.push(lte(families.registrationDate, filters.dateTo));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const familyList = await query.orderBy(desc(families.registrationDate));
    
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
    const [family] = await db.insert(families).values(familyData).returning();
    
    const familyMembersData = members.map(member => ({
      ...member,
      familyId: family.id,
      courses: (member.courses as string[]) || []
    }));
    
    const createdMembers = await db.insert(familyMembers)
      .values(familyMembersData)
      .returning();
    
    return { ...family, members: createdMembers };
  }

  async updateFamily(id: string, familyData: Partial<InsertFamily>, members: Omit<InsertFamilyMember, 'familyId'>[]): Promise<FamilyWithMembers> {
    const [family] = await db.update(families)
      .set({ ...familyData, updatedAt: new Date() })
      .where(eq(families.id, id))
      .returning();
    
    // Delete existing members
    await db.delete(familyMembers).where(eq(familyMembers.familyId, id));
    
    // Insert new members
    const familyMembersData = members.map(member => ({
      ...member,
      familyId: id,
      courses: (member.courses as string[]) || []
    }));
    
    const updatedMembers = await db.insert(familyMembers)
      .values(familyMembersData)
      .returning();
    
    return { ...family, members: updatedMembers };
  }

  async deleteFamily(id: string): Promise<void> {
    await db.delete(families).where(eq(families.id, id));
  }
}

export const storage = new DatabaseStorage();
