import type { Metadata } from "next";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return token ? <ResetForm token={token} /> : <p className="p-10 text-center text-muted">This reset link is missing its token.</p>;
}
