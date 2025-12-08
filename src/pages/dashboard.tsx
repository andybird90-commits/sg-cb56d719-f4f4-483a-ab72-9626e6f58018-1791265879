import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function DashboardContent() {
  const { profile } = useAuth();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome, {profile?.full_name}
          </h1>
          <p className="text-slate-600 mt-1">
            Your role: <span className="capitalize font-medium">{profile?.role}</span>
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Companies</CardTitle>
              <CardDescription>Manage your client companies</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                View and manage all companies in your CRM system.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>Manage your contacts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Access and organize all your business contacts.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Your activity overview</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                More features coming soon...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}