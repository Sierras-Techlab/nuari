import { RecoveryForm } from "@/components/auth/recovery-form";
import { isSafeReturnTo } from "@/lib/navigation/return-to";

export default async function VerifyEmailPage(props?: {
  searchParams?: Promise<{ registered?: string; returnTo?: string }>;
}) {
  const params = props?.searchParams ? await props.searchParams : undefined;
  const safeReturnTo = isSafeReturnTo(params?.returnTo) ? params?.returnTo : undefined;

  return <RecoveryForm mode="verify" initialReturnTo={safeReturnTo} registered={params?.registered === "1"} />;
}
