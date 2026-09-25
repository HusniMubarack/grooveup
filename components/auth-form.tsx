"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export function AuthForm({ mode, next, defaultRole }: { mode: "login" | "register"; next?: string; defaultRole?: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? loginAction : registerAction, undefined);
  return (
    <form action={action} className="mx-auto mt-6 grid max-w-sm gap-4 rounded-xl border bg-card p-5">
      <h1 className="font-serif text-2xl">{mode === "login" ? "Welcome back" : "Join Groove up"}</h1>
      {mode === "register" && (
        <div className="grid gap-1"><Label htmlFor="name">Name</Label><Input id="name" name="name" required autoComplete="name" defaultValue={state?.values?.name} /></div>
      )}
      <div className="grid gap-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" defaultValue={state?.values?.email} /></div>
      <div className="grid gap-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </div>
      {mode === "register" && (
        <div className="grid gap-1">
          <Label htmlFor="role">I want to</Label>
          <Select id="role" name="role" defaultValue={state?.values?.role ?? defaultRole ?? "STUDENT"}>
            <option value="STUDENT">Learn (student)</option>
            <option value="TEACHER">Teach (teacher)</option>
            <option value="BOTH">Both</option>
          </Select>
        </div>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      {state?.error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{state.error}</p>}
      <Button disabled={pending}>{mode === "login" ? "Sign in" : "Create account"}</Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? <>New here? <Link href="/register" className="text-primary">Create an account</Link></> : <>Have an account? <Link href="/login" className="text-primary">Sign in</Link></>}
      </p>
      {mode === "login" && (
        <p className="text-center text-[11px] text-muted-foreground">Demo: teacher@ / student@ / admin@grooveup.dev · password123</p>
      )}
    </form>
  );
}
