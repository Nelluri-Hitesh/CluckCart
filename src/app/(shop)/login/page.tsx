import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser, roleHome } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));
  return <LoginForm next={next} />;
}
