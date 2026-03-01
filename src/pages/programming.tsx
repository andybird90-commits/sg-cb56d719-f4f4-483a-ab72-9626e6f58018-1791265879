import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GanttChart } from "lucide-react";

function ProgrammingContent() {
  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GanttChart className="w-5 h-5 text-sky-500" />
              <span>Programming</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This area is coming soon. Programming tools and configuration will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function ProgrammingPage() {
  return (
    <RequireAuth>
      <ProgrammingContent />
    </RequireAuth>
  );
}