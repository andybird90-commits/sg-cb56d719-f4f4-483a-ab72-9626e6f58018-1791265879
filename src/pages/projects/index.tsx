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
      
      // Sort by project code descending (larger numbers first, with alpha suffixes)
      const sortedData = ((data as any) || []).sort((a: any, b: any) => {
        // Extract numeric and alpha parts from project codes
        const parseCode = (code: string) => {
          const match = code.match(/^(.+?)([a-z]*)$/i);
          if (!match) return { base: code, suffix: '' };
          return { base: match[1], suffix: match[2].toLowerCase() };
        };
        
        const aCode = parseCode(a.code);
        const bCode = parseCode(b.code);
        
        // Compare base codes (numeric comparison if both are numbers)
        const aNum = parseFloat(aCode.base.replace(/[^0-9.-]/g, ''));
        const bNum = parseFloat(bCode.base.replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) {
            return bNum - aNum; // Descending order
          }
        } else {
          const baseCompare = bCode.base.localeCompare(aCode.base);
          if (baseCompare !== 0) {
            return baseCompare;
          }
        }
        
        // If base codes are equal, compare suffixes (a > no suffix, b > a, etc.)
        if (aCode.suffix === bCode.suffix) return 0;
        if (aCode.suffix === '') return 1; // No suffix comes after suffixes
        if (bCode.suffix === '') return -1; // Suffix comes before no suffix
        return bCode.suffix.localeCompare(aCode.suffix); // Reverse for descending
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
        project.code.toLowerCase().includes(searchLower) ||
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