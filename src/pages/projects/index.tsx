import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-600 mt-1">Manage active and pipeline projects</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Setup Required</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              The Projects module requires additional database tables that haven't been set up yet.
            </p>
            <p className="mb-2">
              To enable this feature, please run the SQL migrations from:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>DATABASE_SETUP_PART_B.md</strong> - Creates projects, activities, variations, and related tables</li>
            </ul>
            <p className="mt-3 text-sm">
              After running the migrations, refresh this page to start managing projects.
            </p>
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-slate-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              Projects Module Coming Soon
            </h3>
            <p className="text-slate-600 text-sm">
              Complete the database setup to start managing your projects
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}