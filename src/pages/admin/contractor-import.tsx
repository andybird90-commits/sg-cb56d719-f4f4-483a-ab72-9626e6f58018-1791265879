import { useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { contractorImportService } from "@/services/contractorImportService";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ImportRawRow = Database["public"]["Tables"]["me_contractors_import_raw"]["Row"];

function ContractorImportContent() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportRawRow[]>([]);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; rowCount: number; error: string | null } | null>(null);
  const [importResult, setImportResult] = useState<{ processed: number; inserted: number; updated: number; skipped: number } | null>(null);

  // Check if user has admin/director role
  const hasAccess = profile?.role === "admin" || profile?.role === "director";

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);
    setImportResult(null);

    const result = await contractorImportService.uploadCSV(file);
    
    if (result.error) {
      toast({
        title: "Upload failed",
        description: result.error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Upload successful",
        description: `${result.rowCount} rows uploaded successfully`
      });
      setUploadResult(result);
      await fetchPreviewRows();
    }

    setUploading(false);
    event.target.value = ''; // Reset file input
  };

  const fetchPreviewRows = async () => {
    const result = await contractorImportService.getPreviewRows(20);
    
    if (result.error) {
      toast({
        title: "Error fetching preview",
        description: result.error,
        variant: "destructive"
      });
    } else {
      setPreviewRows(result.data);
    }
  };

  const handleProcessImport = async () => {
    setProcessing(true);
    setImportResult(null);

    const result = await contractorImportService.processImport();
    
    if (result.error) {
      toast({
        title: "Import failed",
        description: result.error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Import complete",
        description: `Processed ${result.processed} rows: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`
      });
      setImportResult(result);
      await fetchPreviewRows();
    }

    setProcessing(false);
  };

  const handleClearProcessed = async () => {
    const result = await contractorImportService.clearProcessedRows();
    
    if (result.error) {
      toast({
        title: "Error clearing rows",
        description: result.error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Processed rows cleared"
      });
      await fetchPreviewRows();
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete all import rows? This cannot be undone.")) {
      return;
    }

    const result = await contractorImportService.deleteAllRows();
    
    if (result.error) {
      toast({
        title: "Error deleting rows",
        description: result.error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "All import rows deleted"
      });
      setPreviewRows([]);
      setUploadResult(null);
      setImportResult(null);
    }
  };

  if (!hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access denied. This page is only available to Admin and Director roles.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Contractor Import</h1>
              <p className="text-muted-foreground">
                Upload CSV files to import SME M&E contractors
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Import Instructions</CardTitle>
            <CardDescription>
              Upload a CSV file containing contractor data. The system will:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Filter to active SME M&E contractors (SIC codes: 43210, 43220, 43290)</li>
              <li>Match existing contractors by company number and update records</li>
              <li>Create new contractor records for unmatched entries</li>
              <li>Automatically seed capabilities based on SIC codes</li>
              <li>Initialize relationship tracking and radar scores</li>
            </ul>
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-2">Expected CSV columns:</p>
              <p className="text-xs text-muted-foreground font-mono">
                company_name, company_number, sic_code, status, postcode, address_line_1, 
                address_line_2, town_city, region, website, phone, email, employees, turnover_gbp
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <label htmlFor="csv-upload">
                <Button asChild disabled={uploading || processing}>
                  <span className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : "Select CSV File"}
                  </span>
                </Button>
              </label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={uploading || processing}
                className="hidden"
              />
              
              {previewRows.length > 0 && (
                <>
                  <Button
                    onClick={handleProcessImport}
                    disabled={uploading || processing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {processing ? "Processing..." : "Import Contractors"}
                  </Button>
                  
                  <Button
                    onClick={handleClearProcessed}
                    variant="outline"
                    disabled={uploading || processing}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Processed
                  </Button>
                  
                  <Button
                    onClick={handleDeleteAll}
                    variant="destructive"
                    disabled={uploading || processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Delete All
                  </Button>
                </>
              )}
            </div>

            {/* Upload Result */}
            {uploadResult && uploadResult.success && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Successfully uploaded {uploadResult.rowCount} rows
                </AlertDescription>
              </Alert>
            )}

            {/* Import Result */}
            {importResult && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Import completed successfully</p>
                    <div className="flex gap-4 text-sm">
                      <span>Processed: <Badge variant="secondary">{importResult.processed}</Badge></span>
                      <span>Inserted: <Badge className="bg-green-600">{importResult.inserted}</Badge></span>
                      <span>Updated: <Badge className="bg-blue-600">{importResult.updated}</Badge></span>
                      <span>Skipped: <Badge variant="outline">{importResult.skipped}</Badge></span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Preview Table */}
        {previewRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Preview - First {previewRows.length} Rows
              </CardTitle>
              <CardDescription>
                Review the data before importing. Only active SME M&E contractors (SIC: 43210, 43220, 43290) will be processed.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Company Number</TableHead>
                      <TableHead>SIC Code</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Postcode</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Turnover (£)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, idx) => {
                      const isTargetSIC = ['43210', '43220', '43290'].includes(row.sic_code || '');
                      const isActive = row.status?.toLowerCase() === 'active';
                      const willProcess = isTargetSIC && isActive;
                      
                      return (
                        <TableRow key={idx} className={!willProcess ? 'opacity-50' : ''}>
                          <TableCell>
                            {row.processed ? (
                              <Badge variant="secondary">Processed</Badge>
                            ) : willProcess ? (
                              <Badge className="bg-green-600">Will Import</Badge>
                            ) : (
                              <Badge variant="outline">Will Skip</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{row.company_name}</TableCell>
                          <TableCell>{row.company_number}</TableCell>
                          <TableCell>
                            <Badge variant={isTargetSIC ? "default" : "secondary"}>
                              {row.sic_code}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.region}</TableCell>
                          <TableCell>{row.postcode}</TableCell>
                          <TableCell>{row.employees}</TableCell>
                          <TableCell>
                            {row.turnover_gbp ? `£${row.turnover_gbp.toLocaleString()}` : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {previewRows.length === 0 && !uploading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Upload className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No data to preview</p>
              <p className="text-sm text-muted-foreground">Upload a CSV file to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

export default function ContractorImport() {
  return (
    <RequireAuth>
      <ContractorImportContent />
    </RequireAuth>
  );
}