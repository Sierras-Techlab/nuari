import {
  WorkspaceSourceError,
  type CashMovement,
  type CashMovementInput,
  type Service,
  type ServiceInput,
  type TeamInput,
  type TeamMember,
  type WorkspaceSource,
} from "./types";

const initialServices: Service[] = [
  { id: "estandar", name: "Servicio estándar", durationMinutes: 40, description: "Atención habitual", active: true },
  { id: "breve", name: "Servicio breve", durationMinutes: 25, description: "Visita corta", active: true },
  { id: "extendido", name: "Servicio extendido", durationMinutes: 60, description: "Atención con más tiempo", active: true },
];

const initialTeam: TeamMember[] = [
  { id: "admin-1", name: "Valeria Ortiz", email: "valeria@negocio.test", role: "admin", active: true },
  { id: "martin", name: "Martín Ríos", email: "martin@negocio.test", role: "professional", active: true },
  { id: "juli", name: "Juli Torres", email: "juli@negocio.test", role: "professional", active: true },
];

const initialCash: CashMovement[] = [
  { id: "movement-1", date: "2026-10-06", kind: "in", concept: "Ingreso manual", amountCents: 1800000 },
  { id: "movement-2", date: "2026-10-06", kind: "out", concept: "Insumos", amountCents: 325000 },
  { id: "movement-3", date: "2026-10-05", kind: "in", concept: "Ingreso manual", amountCents: 950000 },
];

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("es-AR");
}

function validEmail(value: string): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function createLocalWorkspaceSource(): WorkspaceSource {
  let services = initialServices.map((item) => ({ ...item }));
  let team = initialTeam.map((item) => ({ ...item }));
  let movements = initialCash.map((item) => ({ ...item }));
  let nextId = 10;

  return {
    async listServices() { return services.map((item) => ({ ...item })); },
    async createService(input: ServiceInput) {
      const name = input.name.trim();
      const description = input.description.trim();
      if (!name || !Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 480) {
        throw new WorkspaceSourceError("INVALID_INPUT", "Ingresá un nombre y una duración de 5 a 480 minutos.");
      }
      if (services.some((item) => normalized(item.name) === normalized(name))) {
        throw new WorkspaceSourceError("DUPLICATE", "Ya existe un servicio con ese nombre.");
      }
      const created: Service = { id: `service-${nextId++}`, name, durationMinutes: input.durationMinutes, description, active: true };
      services = [...services, created];
      return { ...created };
    },
    async listTeam() { return team.map((item) => ({ ...item })); },
    async createTeamMember(input: TeamInput) {
      const name = input.name.trim();
      const email = input.email.trim();
      if (!name || !email || !validEmail(email) || (input.role !== "admin" && input.role !== "professional")) {
        throw new WorkspaceSourceError("INVALID_INPUT", "Ingresá nombre, correo válido y función.");
      }
      if (team.some((item) => normalized(item.email) === normalized(email))) {
        throw new WorkspaceSourceError("DUPLICATE", "Ya existe un integrante con ese correo.");
      }
      const created: TeamMember = { id: `member-${nextId++}`, name, email, role: input.role, active: true };
      team = [...team, created];
      return { ...created };
    },
    async listCashMovements() { return movements.map((item) => ({ ...item })).sort((a, b) => b.date.localeCompare(a.date)); },
    async createCashMovement(input: CashMovementInput) {
      const concept = input.concept.trim();
      if (!validDate(input.date) || (input.kind !== "in" && input.kind !== "out") || !concept || !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
        throw new WorkspaceSourceError("INVALID_INPUT", "Completá fecha, tipo, concepto e importe positivo.");
      }
      const created: CashMovement = { id: `movement-${nextId++}`, date: input.date, kind: input.kind, concept, amountCents: input.amountCents };
      movements = [created, ...movements];
      return { ...created };
    },
  };
}
