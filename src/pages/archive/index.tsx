import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive as ArchiveIcon, Target, Briefcase } from "lucide-react";

function ArchiveIndexContent() {
  const router = useRouter();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArchiveIcon className="w-6 h-6 text-slate-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Archive</h1>
          </div>
          <p className="text-sm sm:text-base text-slate-600">View and restore archived opportunities and projects</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Archived Opportunities Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/opportunities/archive")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Archived Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                View opportunities that have been won, lost, or manually archived. Restore them to the active list when needed.
              </p>
              <Button variant="outline" className="w-full">
                View Archived Opportunities
              </Button>
            </CardContent>
          </Card>

          {/* Archived Projects Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/projects/archive")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-600" />
                Archived Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                View projects that have been completed, cancelled, or manually archived. Restore them to the active list when needed.
              </p>
              <Button variant="outline" className="w-full">
                View Archived Projects
              </Button>
            </CardContent>
          </Card>

          {/* Invoicing Archive Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/invoicing/archive")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArchiveIcon className="w-5 h-5 text-purple-600" />
                Invoicing Archive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                View locked invoicing periods and their historical revisions. Download archived PDF summaries for each revision.
              </p>
              <Button variant="outline" className="w-full">
                View Invoicing Archive
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default function ArchiveIndexPage() {
  return (
    <RequireAuth>
      <ArchiveIndexContent />
    </RequireAuth>
  );
}