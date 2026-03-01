import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  Users,
  FileText,
  Calendar as CalendarIcon,
  Clock,
  PoundSterling,
  Target,
  Settings,
  LogOut,
  Menu,
  Archive,
  LayoutDashboard,
  Briefcase,
  User,
  Shield,
  Code2,
  BarChart3,
  UserCog,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import React from "react";

interface LayoutProps {
  children: React.ReactNode;
  variant?: "default" | "wide";
}

export function Layout({ children, variant = "default" }: LayoutProps) {
  const { user, profile, loading, signOut, profileError } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-fade-in">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/companies", icon: Building2, label: "Companies" },
    { href: "/contacts", icon: Users, label: "Contacts" },
    { href: "/opportunities", icon: Target, label: "Opportunities" },
    { href: "/projects", icon: Briefcase, label: "Projects" },
    { href: "/calendar", icon: CalendarIcon, label: "Calendar" },
    { href: "/timesheets/my", icon: Clock, label: "Timesheets" },
    { href: "/financials", icon: PoundSterling, label: "Financials" },
    { href: "/invoicing", icon: FileText, label: "Invoicing" },
    { href: "/absences/my", icon: CalendarIcon, label: "Absences" },
    { href: "/health-and-safety", icon: Shield, label: "Health & Safety (Coming Soon)" },
    { href: "/programming", icon: Code2, label: "Programming (Coming Soon)" },
    { href: "/reporting", icon: BarChart3, label: "Reporting (Coming Soon)" },
    { href: "/hr", icon: UserCog, label: "HR (Coming Soon)" },
    { href: "/archive", icon: Archive, label: "Archive" },
  ];

  if (isAdmin) {
    navItems.push({ href: "/admin", icon: Settings, label: "Admin" });
  }

  const NavLink = ({
    href,
    icon: Icon,
    label,
    onClick,
  }: {
    href: string;
    icon: any;
    label: string;
    onClick?: () => void;
  }) => {
    const isActive = router.pathname.startsWith(href);
    return (
      <Link href={href} onClick={onClick}>
        <Button
          variant={isActive ? "default" : "ghost"}
          size="sm"
          className="w-full justify-start gap-3 btn-professional"
        >
          <Icon className="w-4 h-4" />
          <span className="font-medium">{label}</span>
        </Button>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 border-r bg-card shadow-professional">
        <div className="flex items-center justify-center h-20 border-b px-6">
          <Link
            href="/dashboard"
            className="flex items-center justify-center transition-professional hover:opacity-80"
          >
            <div className="rounded-md px-3 py-2">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-blue-500">D</span>
                <span className="text-lime-400">T</span>
              </span>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
            ))}
          </div>
        </div>

        <div className="border-t px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-foreground truncate max-w-[9rem]">
                  {profile?.full_name || user.email}
                </div>
                {profile && (
                  <div className="text-muted-foreground capitalize text-[11px]">
                    {profile.role}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="gap-1 btn-professional whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Top Bar */}
        <nav className="lg:hidden border-b bg-card shadow-professional sticky top-0 z-50 backdrop-blur-sm bg-card/95">
          <div className="flex items-center justify-between h-16 px-6">
            <Link
              href="/dashboard"
              className="flex items-center transition-professional hover:opacity-80"
            >
              <div className="rounded-md px-3 py-1.5">
                <span className="text-xl font-black tracking-tight">
                  <span className="text-blue-500">D</span>
                  <span className="text-lime-400">T</span>
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="gap-2 btn-professional"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Sign Out</span>
              </Button>

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 p-0">
                  <SheetHeader className="border-b p-6 bg-muted/30">
                    <SheetTitle className="text-left font-serif text-xl">Navigation</SheetTitle>
                  </SheetHeader>

                  <ScrollArea className="h-[calc(100vh-100px)]">
                    <div className="p-6">
                      <div className="mb-6 pb-6 border-b">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            {profile ? (
                              <>
                                <div className="font-semibold text-foreground">
                                  {profile.full_name}
                                </div>
                                <div className="text-sm text-muted-foreground capitalize">
                                  {profile.role}
                                </div>
                              </>
                            ) : (
                              <div className="font-semibold text-foreground">{user.email}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mb-6">
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
                        className="w-full gap-2 btn-professional"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="font-medium">Sign Out</span>
                      </Button>
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>

        <main className="container py-8 md:py-12 animate-fade-in">
          {profileError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                <strong className="font-semibold">Profile Error:</strong> {profileError}
              </AlertDescription>
            </Alert>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}