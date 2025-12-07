import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome, {profile.full_name}
          </h1>
          <p className="text-slate-600 mt-1">
            Your role: <span className="capitalize font-medium">{profile.role}</span>
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