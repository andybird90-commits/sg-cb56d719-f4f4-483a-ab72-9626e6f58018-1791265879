import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Archive, 
  RotateCcw, 
  Trash2, 
  Building2, 
  Calendar,
  FileText,
  AlertCircle
} from "lucide-react";

interface ArchivedProject {
  id: string;
  code: string;
  name: string;
  status: string;
  project_reference: string | null;
  archived_at: string | null;
  archived: boolean;
  client_company?: {
    name: string;
  };
  archived_by_profile?: {
    full_name: string;
    email?: string;
  };
}

export default function ProjectsArchive() {
  const router = useRouter();
  const { profile } = useAuth();
  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) {
      fetchArchivedProjects();
    }
  }, [profile]);

  const fetchArchivedProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects" as any)
        .select(`
          *,
          client_company:companies!projects_client_company_id_fkey (
            name
          ),
          archived_by_profile:profiles!projects_archived_by_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("archived", true)
        .order("archived_at", { ascending: false });

      if (error) throw error;
      setProjects((data as any) || []);
    } catch (err) {
      console.error("Failed to load archived projects", err);
      setError("Failed to load archived projects");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (projectId: string) => {
    if (!profile) return;
    if (profile.role !== "director" && profile.role !== "admin") {
      alert("Only Directors and Admins can restore archived projects");
      return;
    }

    try {
      const { error } = await supabase
        .from("projects" as any)
        .update({
          archived: false,
          archived_at: null,
          archived_by_user_id: null,
        })
        .eq("id", projectId);

      if (error) throw error;
      
      await fetchArchivedProjects();
    } catch (err) {
      console.error("Failed to restore project", err);
      alert("Failed to restore project");
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!profile) return;
    if (profile.role !== "admin") {
      alert("Only Admins can permanently delete archived projects");
      return;
    }

    if (!confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("projects" as any)
        .delete()
        .eq("id", projectId);

      if (error) throw error;
      
      await fetchArchivedProjects();
    } catch (err) {
      console.error("Failed to delete project", err);
      alert("Failed to delete project");
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const canRestore = profile?.role === "director" || profile?.role === "admin";
  const canDelete = profile?.role === "admin";

  return (
    <RequireAuth>
      <Layout>
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Archive className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Archived Projects</h1>
                <p className="text-sm text-slate-600">
                  {projects.length} archived {projects.length === 1 ? "project" : "projects"}
                </p>
              </div>
            </div>
            <Button onClick={() => router.push("/projects")}>
              Back to Projects
            </Button>
          </div>

          {/* Permission Notice */}
          {!canRestore && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800">
                    <strong>View Only:</strong> Only Directors and Admins can restore archived projects.
                    {!canDelete && " Only Admins can permanently delete them."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading archived projects...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-800">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!loading && !error && projects.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Archive className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No archived projects</h3>
                <p className="text-slate-600">
                  Completed or cancelled projects will appear here.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Archived Projects Grid */}
          {!loading && !error && projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {projects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                        <FileText className="w-3 h-3" />
                        <span>{project.code}</span>
                      </div>
                      <h3 className="font-semibold text-base sm:text-lg">
                        {project.name}
                      </h3>
                      {project.client_company && (
                        <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                          <Building2 className="w-3 h-3" />
                          {project.client_company.name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      {project.project_reference && (
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span className="font-medium">{project.project_reference}</span>
                        </div>
                      )}

                      {project.archived_at && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Archived: {formatDate(project.archived_at)}</span>
                        </div>
                      )}

                      {project.archived_by_profile && (
                        <div className="text-xs text-slate-500">
                          By: {project.archived_by_profile.full_name || project.archived_by_profile.email || "Unknown"}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-3 border-t">
                      {canRestore && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(project.id)}
                          className="flex-1"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Restore
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(project.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </RequireAuth>
  );
}