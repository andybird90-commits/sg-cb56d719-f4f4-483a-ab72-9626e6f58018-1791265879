import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Building2, Users, LogOut, LayoutDashboard } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  if (!user || !profile) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  const isAdmin = profile.role === "admin" || profile.role === "director";

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-2xl font-bold text-slate-900">
                Conexa DT
              </Link>
              <div className="flex gap-1">
                <Link href="/dashboard">
                  <Button
                    variant={router.pathname === "/dashboard" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/companies">
                  <Button
                    variant={router.pathname.startsWith("/companies") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Building2 className="w-4 h-4" />
                    Companies
                  </Button>
                </Link>
                <Link href="/contacts">
                  <Button
                    variant={router.pathname === "/contacts" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Contacts
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <div className="font-medium text-slate-900">{profile.full_name}</div>
                <div className="text-slate-500 capitalize">{profile.role}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}