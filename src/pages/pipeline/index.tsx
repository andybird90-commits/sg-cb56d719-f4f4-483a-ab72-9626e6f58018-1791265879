import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Opportunity, Project, Company } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

interface PipelineItem {
  id: string;
  type: "opportunity" | "project";
  name: string;
  clientName: string;
  startDate: Date;
  endDate: Date;
  status: string;
  stage?: string;
  value: number;
}

export default function PipelinePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("year"); // quarter, year

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    } else if (user) {
      fetchPipelineData();
    }
  }, [user, authLoading, router]);

  const fetchPipelineData = async () => {
    setLoading(true);
    const pipelineItems: PipelineItem[] = [];

    // Fetch Opportunities
    const { data: opps } = await supabase
      .from("opportunities")
      .select(`*, companies(name)`)
      .in("status", ["open"]);

    if (opps) {
      opps.forEach((opp: any) => {
        if (opp.expected_start_date && opp.expected_end_date) {
          pipelineItems.push({
            id: opp.id,
            type: "opportunity",
            name: opp.name,
            clientName: opp.companies?.name || "Unknown",
            startDate: new Date(opp.expected_start_date),
            endDate: new Date(opp.expected_end_date),
            status: opp.status,
            stage: opp.stage,
            value: opp.expected_fee_value || 0,
          });
        }
      });
    }

    // Fetch Live Projects
    const { data: projs } = await supabase
      .from("projects")
      .select(`*, companies(name)`)
      .in("status", ["live", "pipeline"]);

    if (projs) {
      projs.forEach((proj: any) => {
        if (proj.start_date && proj.end_date) {
          pipelineItems.push({
            id: proj.id,
            type: "project",
            name: proj.name,
            clientName: proj.companies?.name || "Unknown",
            startDate: new Date(proj.start_date),
            endDate: new Date(proj.end_date),
            status: proj.status,
            value: proj.agreed_fee_value || 0,
          });
        }
      });
    }

    // Sort by start date
    pipelineItems.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    setItems(pipelineItems);
    setLoading(false);
  };

  const getStatusColor = (item: PipelineItem) => {
    if (item.type === "project") {
      return "bg-emerald-500";
    }
    // Opportunity colors
    switch (item.stage) {
      case "secured": return "bg-blue-600";
      case "high_potential": return "bg-blue-400";
      default: return "bg-blue-200"; // bid
    }
  };

  // Helper to calculate grid position
  const getGridStyles = (item: PipelineItem, startMonth: Date, totalMonths: number) => {
    const startOffset = (item.startDate.getFullYear() - startMonth.getFullYear()) * 12 + 
                        (item.startDate.getMonth() - startMonth.getMonth());
    
    const durationMonths = ((item.endDate.getFullYear() - item.startDate.getFullYear()) * 12 + 
                           (item.endDate.getMonth() - item.startDate.getMonth())) + 1;

    // Constrain to view
    const visibleStart = Math.max(0, startOffset);
    const visibleEnd = Math.min(totalMonths, startOffset + durationMonths);
    const visibleDuration = Math.max(0, visibleEnd - visibleStart);

    return {
      gridColumnStart: visibleStart + 2, // +2 for label column offset
      gridColumnEnd: `span ${visibleDuration || 1}`,
    };
  };

  if (authLoading || loading) {
    return <Layout>Loading...</Layout>;
  }

  // Gantt Chart Configuration
  const today = new Date();
  const viewStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const totalMonths = 12; // Show next 12 months
  
  const months = Array.from({ length: totalMonths }, (_, i) => {
    const d = new Date(viewStart);
    d.setMonth(d.getMonth() + i);
    return d;
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Pipeline</h1>
            <p className="text-slate-600 mt-1">Project and opportunity timeline</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Live Project
              <span className="w-3 h-3 rounded-full bg-blue-600"></span> Secured Opp
              <span className="w-3 h-3 rounded-full bg-blue-400"></span> High Potential
              <span className="w-3 h-3 rounded-full bg-blue-200"></span> Bid
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[1000px] p-6">
              {/* Header Row */}
              <div className="grid grid-cols-[250px_repeat(12,1fr)] gap-0 border-b mb-4">
                <div className="font-semibold text-slate-900 py-2">Project / Opportunity</div>
                {months.map((m, i) => (
                  <div key={i} className="text-xs text-slate-500 text-center border-l py-2">
                    {m.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  </div>
                ))}
              </div>

              {/* Data Rows */}
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No items with scheduled dates found.
                  </div>
                ) : (
                  items.map((item) => {
                    const styles = getGridStyles(item, viewStart, totalMonths);
                    if (Number(styles.gridColumnEnd.split(' ')[1]) <= 0) return null; // Skip if out of range

                    return (
                      <div key={item.id} className="grid grid-cols-[250px_repeat(12,1fr)] gap-0 items-center hover:bg-slate-50 rounded">
                        <div className="pr-4 py-2">
                          <div className="font-medium text-sm truncate" title={item.name}>
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{item.clientName}</div>
                        </div>
                        
                        {/* Bar */}
                        <div 
                          className={`h-6 rounded-full relative group cursor-pointer ${getStatusColor(item)} opacity-90 hover:opacity-100 transition-opacity`}
                          style={styles}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-max max-w-[200px] bg-slate-900 text-white text-xs rounded p-2 pointer-events-none">
                            <div className="font-bold">{item.name}</div>
                            <div>{item.startDate.toLocaleDateString()} - {item.endDate.toLocaleDateString()}</div>
                            {item.value > 0 && <div>£{item.value.toLocaleString()}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}