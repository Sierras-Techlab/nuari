import type { WorkspaceSource } from "@/features/workspace/types";
export type Preflight = () => Promise<void>;
async function authorized<T>(preflight: Preflight, operation: () => Promise<T>): Promise<T> { await preflight(); return operation(); }
export function guardWorkspaceSource(source: WorkspaceSource, preflight: Preflight): WorkspaceSource {
  return {
    listServices: () => authorized(preflight, () => source.listServices()),
    createService: (input) => authorized(preflight, () => source.createService(input)),
    listTeam: () => authorized(preflight, () => source.listTeam()),
    createTeamMember: (input) => authorized(preflight, () => source.createTeamMember(input)),
    listCashMovements: () => authorized(preflight, () => source.listCashMovements()),
    createCashMovement: (input) => authorized(preflight, () => source.createCashMovement(input)),
  };
}
