import type { Metadata } from "next";

import { ClientsScreen } from "@/features/workspace/clients-screen";

export const metadata: Metadata = { title: "Clientes | Nuari", description: "Directorio de clientes de Nuari." };

export default function ClientsPage() { return <ClientsScreen />; }
