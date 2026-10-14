import type { StaffMember } from '../generated/prisma/client.js';

export function staffSummaryDto(staff: StaffMember) {
  return {
    id: staff.id,
    organizationId: staff.organizationId,
    name: staff.name,
    active: staff.active,
    version: staff.version,
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
  };
}

export function staffDetailDto(staff: StaffMember) {
  return {
    ...staffSummaryDto(staff),
    email: staff.email,
    phone: staff.phone,
    userId: staff.userId,
  };
}
