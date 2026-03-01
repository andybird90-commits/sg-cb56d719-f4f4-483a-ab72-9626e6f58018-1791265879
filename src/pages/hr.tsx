import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog } from "lucide-react";

function HrContent() {
  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-fuchsia-500" />
              <span>HR</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This area is coming soon. HR workflows and insights will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function HrPage() {
  return (
    <RequireAuth>
      <HrContent />
    </RequireAuth>
  );
}