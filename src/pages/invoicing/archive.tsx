import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive as ArchiveIcon, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InvoiceMonthArchiveRow =
  Database["public"]["Tables"]["invoice_month_archives"]["Row"];

interface ArchiveRecord extends InvoiceMonthArchiveRow {}

function InvoiceArchiveContent() {
  const { toast } = useToast();
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchives = async () => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: queryError } = await supabase
        .from("invoice_month_archives")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("revision", { ascending: false });

      if (queryError) throw queryError;

      setArchives(data || []);
    } catch (err) {
      console.error("Failed to load invoice month archives", err);
      setError("Failed to load invoicing archive");
      toast({
        title: "Error",
        description: "Failed to load invoicing archive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArchives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedByMonth = archives.reduce<Record<string, ArchiveRecord[]>>(
    (acc, archive) => {
      const key = `${archive.year}-${String(archive.month).padStart(2, "0")}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(archive);
      return acc;
    },
    {}
  );

  const handleOpenPdf = (url: string) => {
    if (!url) {
      toast({
        title: "Error",
        description: "No PDF URL available for this archive",
        variant: "destructive",
      });
      return;
    }
    window.open(url, "_blank");
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchArchives();
  };

  const monthLabel = (year: number, month: number): string => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const name = months[month - 1] || `Month ${month}`;
    return `${name} ${year}`;
  };

  const sortedMonthKeys = Object.keys(groupedByMonth).sort().reverse();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ArchiveIcon className="w-6 h-6 text-slate-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Invoicing Archive
              </h1>
            </div>
            <p className="text-sm sm:text-base text-slate-600">
              View locked invoicing periods and download archived PDF snapshots for each revision.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-slate-600">Loading invoicing archive...</div>
        ) : error ? (
          <div className="text-red-600 text-sm">{error}</div>
        ) : archives.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArchiveIcon className="w-12 h-12 mb-3 text-slate-300" />
            <p className="text-slate-600 text-base mb-1">No invoicing archives yet</p>
            <p className="text-slate-500 text-sm max-w-md">
              Once you lock invoice periods, snapshot PDFs will appear here with a revision history
              for each month.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMonthKeys.map((key) => {
              const [yearStr, monthStr] = key.split("-");
              const year = parseInt(yearStr, 10);
              const month = parseInt(monthStr, 10);
              const records = groupedByMonth[key].sort(
                (a, b) => (b.revision ?? 0) - (a.revision ?? 0)
              );

              return (
                <Card key={key}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {monthLabel(year, month)}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-1">
                        {records.length} archived revision
                        {records.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {records.map((archive) => (
                        <div
                          key={archive.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-100 rounded-md px-3 py-2 bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">
                              {archive.revision === 0
                                ? "Base"
                                : `Rev ${archive.revision}`}
                            </Badge>
                            <div className="text-xs text-slate-500">
                              Created{" "}
                              {archive.created_at
                                ? new Date(archive.created_at).toLocaleString("en-GB")
                                : "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPdf(archive.pdf_url)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Open PDF
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function InvoiceArchivePage() {
  return (
    <RequireAuth>
      <InvoiceArchiveContent />
    </RequireAuth>
  );
}