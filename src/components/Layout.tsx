import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, Building2, Users, FileText, Calendar, Clock, DollarSign, Target, Settings, LogOut, Menu, ChevronDown, Archive, LayoutDashboard, Briefcase, PoundSterling, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut, profileError } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Only show loading screen while checking auth session
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  // If no user, render content without nav (for auth pages)
  if (!user) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/companies", icon: Building2, label: "Companies" },
    { href: "/contacts", icon: Users, label: "Contacts" },
    { href: "/opportunities", icon: Target, label: "Opportunities" },
    { href: "/projects", icon: Briefcase, label: "Projects" },
    { href: "/timesheets/my", icon: Clock, label: "Timesheets" },
    { href: "/financials", icon: PoundSterling, label: "Financials" },
    { href: "/absences/my", icon: Calendar, label: "Absences" },
  ];

  if (isAdmin) {
    navItems.push({ href: "/admin", icon: Settings, label: "Admin" });
  }

  const NavLink = ({ href, icon: Icon, label, onClick }: { href: string; icon: any; label: string; onClick?: () => void }) => {
    const isActive = router.pathname.startsWith(href);
    return (
      <Link href={href} onClick={onClick}>
        <Button
          variant={isActive ? "default" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2"
        >
          <Icon className="w-4 h-4" />
          <span className="text-sm">{label}</span>
        </Button>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Top Bar */}
      <nav className="lg:hidden border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/dashboard" className="flex items-center">
            <Image 
              src="/RDME_Logo.png" 
              alt="RD GROUP M&E" 
              width={180}
              height={45}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
            
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <SheetHeader className="border-b p-4">
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                
                <ScrollArea className="h-[calc(100vh-80px)]">
                  <div className="p-4">
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          {profile ? (
                            <>
                              <div className="font-medium text-sm text-slate-900">{profile.full_name}</div>
                              <div className="text-xs text-slate-500 capitalize">{profile.role}</div>
                            </>
                          ) : (
                            <div className="font-medium text-sm text-slate-900">{user.email}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 mb-4">
                      {navItems.map((item) => (
                        <NavLink
                          key={item.href}
                          href={item.href}
                          icon={item.icon}
                          label={item.label}
                          onClick={() => setMobileMenuOpen(false)}
                        />
                      ))}
                    </div>

                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={signOut} 
                      className="w-full gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </Button>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Desktop Navigation */}
      <nav className="hidden lg:block border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center">
                <Image 
                  src="/RDME_Logo.png" 
                  alt="RD GROUP M&E" 
                  width={300}
                  height={75}
                  priority
                  className="h-10 w-auto object-contain"
                />
              </Link>
              <div className="flex gap-1">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={router.pathname.startsWith(item.href) ? "default" : "ghost"}
                      size="sm"
                      className="gap-2"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {profile ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-slate-900">{profile.full_name}</div>
                    <div className="text-slate-500 capitalize text-xs">{profile.role}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm">
                  <div className="font-medium text-slate-900">{user.email}</div>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {profileError && (
          <Alert variant="destructive" className="mb-4 sm:mb-6">
            <AlertDescription>
              <strong>Profile Error:</strong> {profileError}
            </AlertDescription>
          </Alert>
        )}
        {children}
      </main>
    </div>
  );
}