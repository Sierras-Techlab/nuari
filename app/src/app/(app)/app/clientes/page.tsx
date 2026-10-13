import type { Metadata } from "next";

import { ClientsScreen } from "@/features/workspace/clients-screen";
import { guardPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = { title: "Clientes | Nuari", description: "Directorio de clientes de Nuari." };

export default async function ClientsPage() { if (!await guardPage("business")) return <AccessError />; return <ClientsScreen />; }
