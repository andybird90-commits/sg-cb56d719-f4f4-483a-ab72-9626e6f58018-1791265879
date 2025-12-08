import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function OpportunitiesPage() {
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
          <h1 className="text-3xl font-bold text-slate-900">Opportunities</h1>
          <p className="text-slate-600 mt-1">Track and manage business opportunities</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Setup Required</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              The Opportunities module requires additional database tables that haven't been set up yet.
            </p>
            <p className="mb-2">
              To enable this feature, please run the SQL migrations from:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>DATABASE_SETUP_PART_B.md</strong> - Creates opportunities, projects, and related tables</li>
            </ul>
            <p className="mt-3 text-sm">
              After running the migrations, refresh this page to start managing opportunities.
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
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              Opportunities Module Coming Soon
            </h3>
            <p className="text-slate-600 text-sm">
              Complete the database setup to start tracking your sales pipeline
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}