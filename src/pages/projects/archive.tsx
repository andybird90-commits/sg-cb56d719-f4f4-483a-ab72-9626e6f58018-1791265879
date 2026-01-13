import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Archive as ArchiveIcon, Briefcase, AlertTriangle, Search, RefreshCw, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ArchivedProject {
  id: string;
  code: string;
  name: string;
  status: string;
  archived_at: string | null;
  archived_reason: string | null;
  companies?: {
    name: string;
  };
  archived_by_profile?: {
    full_name: string | null;
    email: string;
  };
}

function ArchivedProjectsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ArchivedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Everyone can restore
  const canRestore = !!profile;

  useEffect(() => {
    fetchArchivedProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm]);

  const fetchArchivedProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("projects" as any)
        .select(`
          *,
          companies!projects_client_company_id_fkey (
            name
          ),
          archived_by_profile:profiles!projects_archived_by_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("archived", true)
        .order("archived_at", { ascending: false });

      if (fetchError) throw fetchError;
      
      setProjects((data as any) || []);
      setFilteredProjects((data as any) || []);
    } catch (err) {
      console.error("Failed to load archived projects", err);
      setError("Failed to load archived projects");
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    if (!searchTerm) {
      setFilteredProjects(projects);
      return;
    }

    const filtered = projects.filter((project) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        project.code.toLowerCase().includes(searchLower) ||
        project.name.toLowerCase().includes(searchLower) ||
        project.companies?.name.toLowerCase().includes(searchLower)
      );
    });

    setFilteredProjects(filtered);
  };

  const handleRestore = async (projectId: string) => {
    if (!confirm("Are you sure you want to restore this project? It will be moved back to the active projects list.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("projects" as any)
        .update({
          archived: false,
          archived_at: null,
          archived_reason: null,
          archived_by_user_id: null,
        })
        .eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Project restored",
        description: "The project has been restored to the active list.",
      });

      // Refresh the list
      fetchArchivedProjects();
    } catch (err) {
      console.error("Failed to restore project", err);
      toast({
        title: "Error",
        description: "Failed to restore project. Please try again.",
        variant: "destructive",
      });
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

  const getReasonBadge = (reason: string | null) => {
    if (!reason) return null;
    
    const colors = {
      completed: "bg-slate-100 text-slate-800",
      cancelled: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={colors[reason as keyof typeof colors] || "bg-slate-100 text-slate-800"}>
        {reason}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ArchiveIcon className="w-6 h-6 text-slate-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Archived Projects</h1>
            </div>
            <p className="text-sm sm:text-base text-slate-600">View and restore archived projects</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search archived projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && !error && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-slate-600">Loading archived projects...</div>
            </CardContent>
          </Card>
        )}

        {/* Projects List */}
        {!loading && !error && (
          <div className="space-y-3">
            {filteredProjects.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ArchiveIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">
                    {searchTerm ? "No archived projects found" : "No archived projects"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredProjects.map((project) => (
                <Card 
                  key={project.id} 
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4 sm:p-6">
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
                        
                        {/* Status Badges */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge className={`${getStatusColor(project.status)} w-fit text-xs`}>
                            {project.status.replace("_", " ")}
                          </Badge>
                          {getReasonBadge(project.archived_reason)}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                          {project.archived_at && (
                            <span className="text-slate-500">
                              Archived: {formatDate(project.archived_at)}
                            </span>
                          )}
                        </div>

                        {project.archived_by_profile && (
                          <div className="text-xs text-slate-500 mt-1">
                            Archived by {project.archived_by_profile.full_name || project.archived_by_profile.email}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/projects/${project.id}`)}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                        {canRestore && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleRestore(project.id)}
                            className="gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Results count */}
        {!loading && !error && filteredProjects.length > 0 && (
          <div className="text-center text-sm text-slate-600">
            Showing {filteredProjects.length} archived {filteredProjects.length === 1 ? 'project' : 'projects'}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function ArchivedProjectsPage() {
  return (
    <RequireAuth>
      <ArchivedProjectsContent />
    </RequireAuth>
  );
}