import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3 } from "lucide-react";

export default function PipelinePage() {
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
          <h1 className="text-3xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-600 mt-1">Project and opportunity timeline visualization</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Gantt Chart View</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm mb-4">
                Visualize your opportunities and projects on a timeline. See start dates, end dates, and status at a glance.
              </p>
              <Button 
                onClick={() => router.push("/pipeline/gantt")}
                className="w-full"
              >
                View Gantt Chart
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Monthly View</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm mb-4">
                See projects organized by month with expected turnover values. Rolling 12-month view.
              </p>
              <Button 
                onClick={() => router.push("/pipeline/monthly")}
                className="w-full"
                variant="default"
              >
                View Monthly
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-slate-600" />
                </div>
                <CardTitle>Pipeline Analytics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm mb-4">
                Analyze your pipeline performance with detailed metrics and insights.
              </p>
              <Button 
                disabled
                variant="outline"
                className="w-full"
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">-</div>
                <div className="text-xs text-slate-600 mt-1">Active Projects</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">-</div>
                <div className="text-xs text-slate-600 mt-1">Opportunities</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">-</div>
                <div className="text-xs text-slate-600 mt-1">This Quarter</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">-</div>
                <div className="text-xs text-slate-600 mt-1">Win Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}