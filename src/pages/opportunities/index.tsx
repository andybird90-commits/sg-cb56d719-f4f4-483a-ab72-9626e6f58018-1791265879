import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Opportunity, Company, Contact } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Target, Calendar, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

interface OpportunityWithRelations extends Opportunity {
  company?: Company;
  contact?: Contact;
}

export default function OpportunitiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<OpportunityWithRelations[]>([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState<OpportunityWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchOpportunities();
    }
  }, [user]);

  useEffect(() => {
    filterOpportunities();
  }, [opportunities, searchTerm, activeTab]);

  const fetchOpportunities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        *,
        companies!opportunities_company_id_fkey (
          id,
          name,
          short_name,
          status
        ),
        contacts!opportunities_contact_id_fkey (
          id,
          name,
          email,
          phone
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const formatted = data.map((opp: any) => ({
        ...opp,
        company: opp.companies,
        contact: opp.contacts,
        companies: undefined,
        contacts: undefined,
      }));
      setOpportunities(formatted);
    }
    setLoading(false);
  };

  const filterOpportunities = () => {
    let filtered = opportunities;

    if (activeTab !== "all") {
      if (activeTab === "open") {
        filtered = filtered.filter((opp) => opp.status === "open");
      } else {
        filtered = filtered.filter((opp) => opp.stage === activeTab);
      }
    }

    if (searchTerm) {
      filtered = filtered.filter((opp) =>
        opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOpportunities(filtered);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "secured":
        return "bg-green-100 text-green-800";
      case "high_potential":
        return "bg-blue-100 text-blue-800";
      case "bid":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800";
      case "closed_won":
        return "bg-green-100 text-green-800";
      case "closed_lost":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Opportunities</h1>
            <p className="text-slate-600 mt-1">Track and manage business opportunities</p>
          </div>
          {isAdmin && (
            <Link href="/opportunities/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Opportunity
              </Button>
            </Link>
          )}
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search opportunities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="secured">Secured</TabsTrigger>
            <TabsTrigger value="high_potential">High Potential</TabsTrigger>
            <TabsTrigger value="bid">Bid</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredOpportunities.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Target className="w-12 h-12 text-slate-400 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-1">No opportunities found</h3>
                  <p className="text-slate-600 text-sm">
                    {opportunities.length === 0
                      ? "Get started by adding your first opportunity"
                      : "Try adjusting your search or filters"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredOpportunities.map((opp) => (
                  <Link key={opp.id} href={`/opportunities/${opp.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {opp.name}
                              </h3>
                              <Badge className={getStageColor(opp.stage)}>
                                {opp.stage.replace("_", " ")}
                              </Badge>
                              <Badge className={getStatusColor(opp.status)}>
                                {opp.status.replace("_", " ")}
                              </Badge>
                            </div>
                            {opp.company && (
                              <p className="text-sm text-slate-600 mb-2">
                                {opp.company.name}
                              </p>
                            )}
                            {opp.description && (
                              <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                {opp.description}
                              </p>
                            )}
                            <div className="flex gap-6 text-sm text-slate-600">
                              {opp.expected_fee_value && (
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-4 h-4" />
                                  <span>{formatCurrency(opp.expected_fee_value)}</span>
                                </div>
                              )}
                              {opp.tender_due_date && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>Due: {formatDate(opp.tender_due_date)}</span>
                                </div>
                              )}
                              {opp.expected_start_date && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>Start: {formatDate(opp.expected_start_date)}</span>
                                </div>
                              )}
                              {opp.probability_percent !== null && (
                                <div>
                                  <span className="font-medium">{opp.probability_percent}%</span> probability
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}