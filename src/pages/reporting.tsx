import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

function ReportingContent() {
  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span>Reporting</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This area is coming soon. Reporting dashboards and exports will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function ReportingPage() {
  return (
    <RequireAuth>
      <ReportingContent />
    </RequireAuth>
  );
}