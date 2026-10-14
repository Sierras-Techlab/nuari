import type { StaffMember, StaffService, Service } from '../generated/prisma/client.js';

type StaffServiceWithParents = StaffService & { staffMember: StaffMember; service: Service };

export function staffServiceDto(link: StaffServiceWithParents) {
  return {
    organizationId: link.organizationId,
    serviceId: link.serviceId,
    staffMemberId: link.staffMemberId,
    createdAt: link.createdAt.toISOString(),
    staff: { id: link.staffMember.id, name: link.staffMember.name, active: link.staffMember.active },
    service: { id: link.service.id, name: link.service.name, active: link.service.active },
  };
}
