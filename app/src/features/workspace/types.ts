export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  description: string;
  active: boolean;
};

export type ServiceInput = Pick<Service, "name" | "durationMinutes" | "description">;

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
};

export type ClientInput = Omit<Client, "id">;

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "professional";
  active: boolean;
};

export type TeamInput = Pick<TeamMember, "name" | "email" | "role">;

export type CashMovement = {
  id: string;
  date: string;
  kind: "in" | "out";
  concept: string;
  amountCents: number;
};

export type CashMovementInput = Omit<CashMovement, "id">;

export interface WorkspaceSource {
  listServices(): Promise<Service[]>;
  createService(input: ServiceInput): Promise<Service>;
  listClients(): Promise<Client[]>;
  createClient(input: ClientInput): Promise<Client>;
  listTeam(): Promise<TeamMember[]>;
  createTeamMember(input: TeamInput): Promise<TeamMember>;
  listCashMovements(): Promise<CashMovement[]>;
  createCashMovement(input: CashMovementInput): Promise<CashMovement>;
}

export class WorkspaceSourceError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "DUPLICATE", message: string) {
    super(message);
    this.name = "WorkspaceSourceError";
  }
}
