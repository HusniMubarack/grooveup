import Link from "next/link";
import { Shield } from "lucide-react";
import { currentMode, currentUser, isTeacher } from "@/lib/auth";
import { logoutAction, setModeAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export async function Header() {
  const user = await currentUser();
  const mode = await currentMode(user?.role);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" aria-label="Groove up home">
          <Logo size={26} />
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
          <Link href="/explore" className="hover:text-foreground">Explore</Link>
          {user && <Link href="/me" className="hover:text-foreground">My Floor</Link>}
          {isTeacher(user?.role) && <Link href="/studio" className="hover:text-foreground">Studio</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Badge variant={user.role === "ADMIN" ? "destructive" : "outline"}>
                {user.role === "BOTH" ? `Both · ${mode}` : user.role}
              </Badge>
              {user.role === "BOTH" && (
                <form action={setModeAction.bind(null, mode === "teacher" ? "student" : "teacher")}>
                  <Button size="sm" variant="secondary">
                    Switch to {mode === "teacher" ? "student" : "teacher"}
                  </Button>
                </form>
              )}
              {user.role === "TEACHER" && (
                <Button asChild size="sm" variant="secondary" className="md:hidden">
                  <Link href="/studio">Studio</Link>
                </Button>
              )}
              {user.role === "ADMIN" && (
                <Button asChild size="sm" variant="secondary">
                  <Link href="/admin"><Shield /> Admin</Link>
                </Button>
              )}
              <form action={logoutAction} className="hidden md:block">
                <Button size="sm" variant="ghost">Sign out</Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost"><Link href="/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link href="/register">Join</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
