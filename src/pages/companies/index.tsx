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
import { Plus, Search } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const canEdit = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    filterCompanies();
  }, [companies, searchTerm]);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("name");

    if (!error && data) {
      setCompanies(data);
    }
    setLoading(false);
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
            <h1 className="text-3xl font-bold text-slate-900">Companies</h1>
            <p className="text-slate-600 mt-1">Manage your client companies</p>
          </div>
          {canEdit && (
            <Link href="/companies/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Company
              </Button>
            </Link>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4">
          {filteredCompanies.map((company) => (
            <Card 
              key={company.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/companies/${company.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {company.name}
                      </h3>
                      <Badge className={getStatusColor(company.status)}>
                        {company.status}
                      </Badge>
                    </div>
                    {company.sector && (
                      <p className="text-sm text-slate-600">{company.sector}</p>
                    )}
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

export default function CompaniesPage() {
  return (
    <RequireAuth>
      <CompaniesContent />
    </RequireAuth>
  );
}