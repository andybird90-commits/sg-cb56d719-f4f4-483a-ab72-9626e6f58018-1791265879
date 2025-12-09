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
import { Plus, Search, Building2, ChevronRight, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
  short_name: string | null;
  sector: string | null;
  status: string;
  created_at: string;
}

function CompaniesContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const canEdit = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    filterCompanies();
  }, [companies, searchTerm]);

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("companies")
        .select("*")
        .order("name");

      if (fetchError) throw fetchError;
      setCompanies(data || []);
    } catch (err) {
      console.error("Failed to load companies data", err);
      setError("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  };

  const filterCompanies = () => {
    if (!searchTerm) {
      setFilteredCompanies(companies);
      return;
    }

    const filtered = companies.filter((company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.sector?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredCompanies(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "prospect":
        return "bg-blue-100 text-blue-800";
      case "inactive":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Companies</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Manage your client companies</p>
          </div>
          {canEdit && (
            <Link href="/companies/new">
              <Button className="w-full sm:w-auto gap-2">
                <Plus className="w-4 h-4" />
                <span className="sm:inline">New Company</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search companies..."
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

        {/* Companies List */}
        <div className="space-y-3">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-slate-600">Loading companies...</div>
              </CardContent>
            </Card>
          ) : filteredCompanies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600">
                  {searchTerm ? "No companies found" : "No companies yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCompanies.map((company) => (
              <Card 
                key={company.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/companies/${company.id}`)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                          {company.name}
                        </h3>
                        <Badge className={`${getStatusColor(company.status)} w-fit text-xs`}>
                          {company.status}
                        </Badge>
                      </div>
                      {company.sector && (
                        <p className="text-sm text-slate-600">{company.sector}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}

export default function CompaniesPage() {
  return (
    <RequireAuth>
      <CompaniesContent />
    </RequireAuth>
  );
}