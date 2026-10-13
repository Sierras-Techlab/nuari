import type { Metadata } from "next";

import { ServicesScreen } from "@/features/workspace/services-screen";
import { guardPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = { title: "Servicios | Nuari", description: "Catálogo de servicios del Turnero." };

export default async function ServicesPage() { if (!await guardPage("business")) return <AccessError />; return <ServicesScreen />; }
