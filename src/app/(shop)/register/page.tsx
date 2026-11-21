import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { getCurrentUser, roleHome } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));
  return <RegisterForm next={next} />;
}
