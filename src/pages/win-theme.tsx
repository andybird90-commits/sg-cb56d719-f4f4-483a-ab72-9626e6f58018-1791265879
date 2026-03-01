import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, ArrowRight } from "lucide-react";

function WinThemeContent() {
  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative inline-flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-500" />
                <ArrowRight className="w-3 h-3 text-amber-500 absolute" />
              </span>
              <span>Win Theme</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This area is coming soon. Win theme tools, templates, and workflows will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function WinThemePage() {
  return (
    <RequireAuth>
      <WinThemeContent />
    </RequireAuth>
  );
}