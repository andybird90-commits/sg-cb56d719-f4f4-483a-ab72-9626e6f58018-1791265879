import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function ReportsPage() {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const downloadProjectsSummary = async () => {
    try {
      setDownloading(true);

      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to download reports",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch("/api/reports/projects-summary", {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projects-summary-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download complete",
        description: "Projects summary downloaded successfully"
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download report",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download various reports from your project data
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Projects Summary Report
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Complete summary of all tendered opportunities and secured projects
                  </CardDescription>
                </div>
                <Button 
                  onClick={downloadProjectsSummary} 
                  disabled={downloading}
                  size="sm"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>This report includes:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>All opportunities (tendered/bid opportunities) with client details</li>
                  <li>All secured projects with agreed values and dates</li>
                  <li>Client names, sectors, and contact information</li>
                  <li>Fee values, dates, and reference numbers</li>
                  <li>Project status and stages</li>
                  <li>Created dates and ownership information</li>
                  <li>Archived status and reasons</li>
                </ul>
                <p className="mt-4 text-xs">
                  Data is exported in CSV format for easy import into Excel or other tools.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-muted-foreground">More reports coming soon</CardTitle>
              <CardDescription>
                Additional report types will be added based on your needs
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </Layout>
  );
}