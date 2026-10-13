import type { ReactNode } from "react";

import { AccessProvider, PrivateWorkspace } from "@/features/access/access-provider";
import { AccessError } from "@/features/access/access-error";
import { guardPage } from "@/lib/auth/server";

export default async function InternalAppLayout({ children }: { children: ReactNode }) {
  const snapshot = await guardPage("app");
  if (!snapshot) return <AccessError />;
  return <AccessProvider initialSnapshot={snapshot}><PrivateWorkspace>{children}</PrivateWorkspace></AccessProvider>;
}
