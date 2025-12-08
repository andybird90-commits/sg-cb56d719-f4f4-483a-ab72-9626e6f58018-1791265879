import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function FinancialsPage() {
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
          <h1 className="text-3xl font-bold text-slate-900">Financial Dashboard</h1>
          <p className="text-slate-600 mt-1">Monthly revenue, costs, and margins</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Setup Required</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              The Financial Dashboard requires additional database tables that haven't been set up yet.
            </p>
            <p className="mb-2">
              To enable this feature, please run the SQL migrations from:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>DATABASE_SETUP_PART_B.md</strong> - Creates projects, timesheets, and costs tables</li>
              <li><strong>DATABASE_SETUP_PART_C.md</strong> - Creates monthly budgets table</li>
            </ul>
            <p className="mt-3 text-sm">
              After running the migrations, refresh this page to view financial reports.
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              Financial Dashboard Coming Soon
            </h3>
            <p className="text-slate-600 text-sm">
              Complete the database setup to view your financial reports
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}