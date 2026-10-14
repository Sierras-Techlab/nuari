import { createStaffMember, getStaff, getStaffMember, getStaffMemberServices, updateStaffMember } from "@/lib/api/browser";
import type { CreateStaffInput, StaffDTO, StaffListInput, StaffPageDTO, StaffServiceListQuery, StaffServicePageDTO, UpdateStaffInput } from "@/lib/api/contracts";

export function listStaff(organizationId: string, query: StaffListInput, signal?: AbortSignal): Promise<StaffPageDTO> {
  return getStaff(organizationId, query, signal);
}

export function readStaff(organizationId: string, staffMemberId: string, signal?: AbortSignal): Promise<StaffDTO> {
  return getStaffMember(organizationId, staffMemberId, signal);
}

export function addStaff(organizationId: string, input: CreateStaffInput): Promise<StaffDTO> {
  return createStaffMember(organizationId, input);
}

export function saveStaff(organizationId: string, staffMemberId: string, input: UpdateStaffInput, version: number): Promise<StaffDTO> {
  return updateStaffMember(organizationId, staffMemberId, input, version);
}

export function listStaffServices(organizationId: string, staffMemberId: string, query: StaffServiceListQuery, signal?: AbortSignal): Promise<StaffServicePageDTO> {
  return getStaffMemberServices(organizationId, staffMemberId, query, signal);
}
