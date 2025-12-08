import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  agreed_fee_value: number | null;
  notes: string | null;
  companies?: {
    name: string;
  };
  opportunities?: {
    name: string;
  };
}

function ProjectDetailContent() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchProject(id);
    }
  }, [id]);

  const fetchProject = async (projectId: string) => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("projects")
      .select(`
        *,
        companies!projects_client_company_id_fkey (
          name
        ),
        opportunities (
          name
        )
      `)
      .eq("id", projectId)
      .single();

    if (fetchError || !data) {
      setError("Project not found");
      setLoading(false);
      return;
    }

    setProject(data);
    setLoading(false);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-green-100 text-green-800";
      case "pipeline":
        return "bg-blue-100 text-blue-800";
      case "on_hold":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-slate-100 text-slate-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (error || !project) {
    return (
      <Layout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Link href="/projects">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-slate-500">{project.code}</span>
              <CardTitle className="text-2xl">{project.name}</CardTitle>
              <Badge className={getStatusColor(project.status)}>
                {project.status.replace("_", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {project.companies && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">Client</div>
                    <div className="text-slate-900">{project.companies.name}</div>
                  </div>
                )}
                
                {project.opportunities && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">Linked Opportunity</div>
                    <div className="text-slate-900">{project.opportunities.name}</div>
                  </div>
                )}

                {project.agreed_fee_value && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">Agreed Fee</div>
                    <div className="text-slate-900 font-semibold">{formatCurrency(project.agreed_fee_value)}</div>
                  </div>
                )}

                {project.start_date && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">Start Date</div>
                    <div className="text-slate-900">{formatDate(project.start_date)}</div>
                  </div>
                )}

                {project.end_date && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">End Date</div>
                    <div className="text-slate-900">{formatDate(project.end_date)}</div>
                  </div>
                )}
              </div>

              {project.notes && (
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Notes</div>
                  <div className="text-slate-900 whitespace-pre-wrap">{project.notes}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-center py-8">
              Activities, variations, and costs will be added in the next phase.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function ProjectDetailPage() {
  return (
    <RequireAuth>
      <ProjectDetailContent />
    </RequireAuth>
  );
}