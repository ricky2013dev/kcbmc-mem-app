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
}

export const storage = new DatabaseStorage();
