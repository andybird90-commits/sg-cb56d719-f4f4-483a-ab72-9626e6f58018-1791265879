import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  companies?: {
    name: string;
  };
}

function ProjectsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const canEdit = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select(`
        *,
        companies!projects_client_company_id_fkey (
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (data) setProjects(data);
    setLoading(false);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
            <p className="text-slate-600 mt-1">Manage active and pipeline projects</p>
          </div>
          {canEdit && (
            <Link href="/projects/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </Link>
          )}
        </div>

        <div className="grid gap-4">
          {projects.map((project) => (
            <Card 
              key={project.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-slate-500">{project.code}</span>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {project.name}
                      </h3>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">{project.companies?.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default function ProjectsPage() {
  return (
    <RequireAuth>
      <ProjectsContent />
    </RequireAuth>
  );
}