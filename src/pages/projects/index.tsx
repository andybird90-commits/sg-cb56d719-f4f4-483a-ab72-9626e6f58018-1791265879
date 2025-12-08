import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, Briefcase } from "lucide-react";
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
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Manage active and pipeline projects</p>
          </div>
          {canEdit && (
            <Link href="/projects/new">
              <Button className="w-full sm:w-auto gap-2">
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Projects List - Mobile: Cards, Desktop: Cards with more details */}
        <div className="space-y-3">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600">No projects yet</p>
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => (
              <Card 
                key={project.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <CardContent className="p-4 sm:p-6">
                  {/* Mobile & Tablet Layout */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <span className="font-mono text-xs sm:text-sm text-slate-500 flex-shrink-0">
                          {project.code}
                        </span>
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                          {project.name}
                        </h3>
                      </div>
                      
                      {/* Client */}
                      <p className="text-sm text-slate-600 mb-2">{project.companies?.name}</p>
                      
                      {/* Status Badge */}
                      <Badge className={`${getStatusColor(project.status)} w-fit text-xs`}>
                        {project.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Results count - Mobile friendly */}
        {projects.length > 0 && (
          <div className="text-center text-sm text-slate-600">
            Showing {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </div>
        )}
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