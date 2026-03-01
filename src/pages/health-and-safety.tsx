import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

function HealthAndSafetyContent() {
  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span>Health &amp; Safety</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This area is coming soon. Health and safety dashboards and workflows will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function HealthAndSafetyPage() {
  return (
    <RequireAuth>
      <HealthAndSafetyContent />
    </RequireAuth>
  );
}