import type { WorkspaceSource } from "@/features/workspace/types";
import type { AppointmentSource } from "@/features/appointments/types";
export type Preflight = () => Promise<void>;
async function authorized<T>(preflight: Preflight, operation: () => Promise<T>): Promise<T> { await preflight(); return operation(); }
export function guardWorkspaceSource(source: WorkspaceSource, preflight: Preflight): WorkspaceSource {
  return {
    listServices: () => authorized(preflight, () => source.listServices()),
    createService: (input) => authorized(preflight, () => source.createService(input)),
    listClients: () => authorized(preflight, () => source.listClients()),
    createClient: (input) => authorized(preflight, () => source.createClient(input)),
    listTeam: () => authorized(preflight, () => source.listTeam()),
    createTeamMember: (input) => authorized(preflight, () => source.createTeamMember(input)),
    listCashMovements: () => authorized(preflight, () => source.listCashMovements()),
    createCashMovement: (input) => authorized(preflight, () => source.createCashMovement(input)),
  };
}
export function guardAppointmentSource(source: AppointmentSource, preflight: Preflight): AppointmentSource {
  return {
    getSetup: () => authorized(preflight, () => source.getSetup()),
    list: (date) => authorized(preflight, () => source.list(date)),
    create: (input) => authorized(preflight, () => source.create(input)),
    reschedule: (id, slot) => authorized(preflight, () => source.reschedule(id, slot)),
    cancel: (id) => authorized(preflight, () => source.cancel(id)),
  };
}
