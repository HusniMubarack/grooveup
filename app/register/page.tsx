import { AuthForm } from "@/components/auth-form";

export default async function Register({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  return <AuthForm mode="register" defaultRole={(await searchParams).role} />;
}
