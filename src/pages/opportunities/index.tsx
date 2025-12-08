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

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  status: string;
  expected_fee_value: number | null;
  companies?: {
    name: string;
  };
}

function OpportunitiesContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const canEdit = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("opportunities")
      .select(`
        *,
        companies (
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (data) setOpportunities(data);
    setLoading(false);
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

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
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
            <h1 className="text-3xl font-bold text-slate-900">Opportunities</h1>
            <p className="text-slate-600 mt-1">Track and manage business opportunities</p>
          </div>
          {canEdit && (
            <Link href="/opportunities/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Opportunity
              </Button>
            </Link>
          )}
        </div>

        <div className="grid gap-4">
          {opportunities.map((opp) => (
            <Card 
              key={opp.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/opportunities/${opp.id}`)}
            >
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
                      <Badge variant="outline">{opp.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{opp.companies?.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-500">Expected Value</div>
                    <div className="text-lg font-semibold">{formatCurrency(opp.expected_fee_value)}</div>
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

export default function OpportunitiesPage() {
  return (
    <RequireAuth>
      <OpportunitiesContent />
    </RequireAuth>
  );
}