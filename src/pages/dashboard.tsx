import { useRouter } from "next/router";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, LogOut } from "lucide-react";

function DashboardContent() {
  const router = useRouter();
  const { session } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/signin");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="text-2xl font-bold text-slate-900">
              Conexa DT
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Welcome back!
            </h1>
            <p className="text-slate-600 mt-1">
              Your email: {session?.user?.email}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card 
              onClick={() => router.push("/companies")} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-blue-600" />
                  <CardTitle>Companies</CardTitle>
                </div>
                <CardDescription>Manage your client companies</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  View and manage all companies in your CRM system.
                </p>
              </CardContent>
            </Card>

            <Card 
              onClick={() => router.push("/contacts")} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-green-600" />
                  <CardTitle>Contacts</CardTitle>
                </div>
                <CardDescription>Manage your contacts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Access and organize all your business contacts.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}