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
import { Plus, ChevronRight, Briefcase, AlertTriangle, Search } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  project_reference: string;
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
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Everyone can create/edit, only directors/admins can delete
  const canEdit = !!profile;
  const canDelete = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("projects" as any)
        .select(`
          *,
          companies!projects_client_company_id_fkey(
            name
          )
        `)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      
      // Sort projects: P26xxx first (ascending), then P25xxx (ascending), then others alphabetically
      const sortedData = ((data as any) || []).sort((a: any, b: any) => {
        const aRef = a.project_reference || '';
        const bRef = b.project_reference || '';
        
        // Extract year and number from references like "P26001"
        const aMatch = aRef.match(/^P(\d{2})(\d+)$/);
        const bMatch = bRef.match(/^P(\d{2})(\d+)$/);
        
        // If both have valid references
        if (aMatch && bMatch) {
          const aYear = parseInt(aMatch[1]);
          const bYear = parseInt(bMatch[1]);
          const aNum = parseInt(aMatch[2]);
          const bNum = parseInt(bMatch[2]);
          
          // Sort by year descending (26 before 25)
          if (aYear !== bYear) {
            return bYear - aYear;
          }
          
          // Within same year, sort by number descending (002, 001)
          return bNum - aNum;
        }
        
        // If only A has a valid reference, A comes first
        if (aMatch) return -1;
        
        // If only B has a valid reference, B comes first
        if (bMatch) return 1;
        
        // If neither has a valid reference, sort alphabetically by name
        return (a.name || '').localeCompare(b.name || '');
      });
      
      setProjects(sortedData);
    } catch (err) {
      console.error("Failed to load projects data", err);
      setError("Failed to load projects");
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
        (project.project_reference && project.project_reference.toLowerCase().includes(searchLower)) ||
        project.name.toLowerCase().includes(searchLower) ||
        project.companies?.name.toLowerCase().includes(searchLower)
      );
    });

    setFilteredProjects(filtered);
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

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Projects
            </h1>
            <p className="text-muted-foreground text-lg">
              Active and completed project portfolio
            </p>
          </div>
          <Button
            onClick={() => router.push("/projects/new")}
            className="btn-professional shadow-lg hover:shadow-xl">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search by job number, client, or project name..."
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
              <div className="text-slate-600">Loading projects...</div>
            </CardContent>
          </Card>
        )}

        {/* Projects List - Mobile: Cards, Desktop: Cards with more details */}
        {!loading && !error && (
          <div className="space-y-3">
            {filteredProjects.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">
                    {searchTerm ? "No projects found" : "No projects yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredProjects.map((project) => (
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
                          {project.project_reference && (
                            <span className="font-mono text-xs sm:text-sm text-slate-500 flex-shrink-0">
                              {project.project_reference}
                            </span>
                          )}
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
        )}

        {/* Results count - Mobile friendly */}
        {!loading && !error && filteredProjects.length > 0 && (
          <div className="text-center text-sm text-slate-600">
            Showing {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
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