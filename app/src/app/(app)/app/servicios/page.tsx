import type { Metadata } from "next";

import { ServicesScreen } from "@/features/workspace/services-screen";

export const metadata: Metadata = { title: "Servicios | Nuari", description: "Catálogo de servicios del Turnero." };

export default function ServicesPage() { return <ServicesScreen />; }
