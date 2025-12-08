import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Target } from "lucide-react";

function DashboardContent() {
  const router = useRouter();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome to Conexa DT</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
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

          <Card 
            onClick={() => router.push("/opportunities")} 
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-purple-600" />
                <CardTitle>Opportunities</CardTitle>
              </div>
              <CardDescription>Track sales pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Monitor and manage your sales opportunities.
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