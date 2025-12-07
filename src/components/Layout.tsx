import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Building2, Users, LogOut, LayoutDashboard, Target, Briefcase, Calendar, Clock, TrendingUp, CalendarDays, Settings } from "lucide-react";

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
                <Link href="/opportunities">
                  <Button
                    variant={router.pathname.startsWith("/opportunities") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Target className="w-4 h-4" />
                    Opportunities
                  </Button>
                </Link>
                <Link href="/projects">
                  <Button
                    variant={router.pathname.startsWith("/projects") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Briefcase className="w-4 h-4" />
                    Projects
                  </Button>
                </Link>
                <Link href="/pipeline">
                  <Button
                    variant={router.pathname === "/pipeline" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Pipeline
                  </Button>
                </Link>
                <Link href="/timesheets">
                  <Button
                    variant={router.pathname.startsWith("/timesheets") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Timesheets
                  </Button>
                </Link>
                <Link href="/financials">
                  <Button
                    variant={router.pathname === "/financials" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Financials
                  </Button>
                </Link>
                <Link href="/absences">
                  <Button
                    variant={router.pathname.startsWith("/absences") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <CalendarDays className="w-4 h-4" />
                    Absences
                  </Button>
                </Link>
                {isAdmin && (
                  <Link href="/admin">
                    <Button
                      variant={router.pathname.startsWith("/admin") ? "default" : "ghost"}
                      size="sm"
                      className="gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Admin
                    </Button>
                  </Link>
                )}
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