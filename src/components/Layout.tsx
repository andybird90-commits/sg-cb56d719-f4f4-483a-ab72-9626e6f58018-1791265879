import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Building2, Users, Target, Briefcase, LogOut, LayoutDashboard, Clock, Calendar, PoundSterling, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut, profileError } = useAuth();
  const router = useRouter();

  // If still loading auth, show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  // If no user at all, render without navigation (auth pages)
  if (!user) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center">
                <Image 
                  src="/RDME_Logo.png" 
                  alt="RD GROUP M&E" 
                  width={180} 
                  height={45}
                  priority
                  className="h-10 w-auto"
                />
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
                <Link href="/timesheets/my">
                  <Button
                    variant={router.pathname.startsWith("/timesheets") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Timesheets
                  </Button>
                </Link>
                <Link href="/absences/my">
                  <Button
                    variant={router.pathname.startsWith("/absences") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Absences
                  </Button>
                </Link>
                <Link href="/financials">
                  <Button
                    variant={router.pathname.startsWith("/financials") ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <PoundSterling className="w-4 h-4" />
                    Financials
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
              {profile ? (
                <div className="text-sm">
                  <div className="font-medium text-slate-900">{profile.full_name}</div>
                  <div className="text-slate-500 capitalize">{profile.role}</div>
                </div>
              ) : profileError ? (
                <div className="text-sm">
                  <div className="font-medium text-slate-900">{user.email}</div>
                  <div className="text-xs text-red-600">Profile error</div>
                </div>
              ) : (
                <div className="text-sm">
                  <div className="font-medium text-slate-900">{user.email}</div>
                  <div className="text-slate-500 text-xs">Profile loading...</div>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {profileError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              <strong>Profile Error:</strong> {profileError}
              <br />
              <span className="text-sm mt-2 block">
                Please check that:
                <br />
                1. Supabase is connected (check .env.local or Softgen settings)
                <br />
                2. Database tables exist (run DATABASE_SETUP.md SQL migrations)
                <br />
                3. Your profile row exists in the profiles table
              </span>
            </AlertDescription>
          </Alert>
        )}
        {children}
      </main>
    </div>
  );
}