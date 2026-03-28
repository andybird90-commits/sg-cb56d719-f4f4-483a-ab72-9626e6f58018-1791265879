import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, AlertCircle, Download, Trash2, Loader2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { companyDocumentsService, CompanyDocument } from "@/services/companyDocumentsService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CompanyDocumentsPage() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    expiry_date: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await companyDocumentsService.getDocuments();
      setDocuments(data);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error",
        description: "Failed to load company documents.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.expiry_date) {
      toast({
        title: "Validation Error",
        description: "Please provide a title and an expiry date.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await companyDocumentsService.createDocument(formData, selectedFile || undefined);
      
      toast({
        title: "Success",
        description: "Company document added successfully.",
      });
      
      setIsDialogOpen(false);
      setFormData({ title: "", description: "", expiry_date: "" });
      setSelectedFile(null);
      fetchDocuments();
    } catch (error) {
      console.error("Error creating document:", error);
      toast({
        title: "Error",
        description: "Failed to upload document.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, filePath: string | null) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await companyDocumentsService.deleteDocument(id, filePath);
      toast({
        title: "Success",
        description: "Document deleted successfully.",
      });
      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Error",
        description: "Failed to delete document.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (filePath: string, filename: string) => {
    try {
      await companyDocumentsService.downloadDocument(filePath, filename);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Error",
        description: "Failed to download document.",
        variant: "destructive",
      });
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (days: number) => {
    if (days < 0) return { label: "Expired", color: "text-red-600 bg-red-50 border-red-200", alertVariant: "destructive" as const };
    if (days === 0) return { label: "Expires Today", color: "text-red-600 bg-red-50 border-red-200", alertVariant: "destructive" as const };
    if (days <= 7) return { label: `Expires in ${days} days`, color: "text-orange-600 bg-orange-50 border-orange-200", alertVariant: "destructive" as const };
    if (days <= 14) return { label: `Expires in ${days} days`, color: "text-amber-600 bg-amber-50 border-amber-200", alertVariant: "default" as const };
    if (days <= 30) return { label: `Expires in ${days} days`, color: "text-yellow-600 bg-yellow-50 border-yellow-200", alertVariant: "default" as const };
    return { label: "Valid", color: "text-emerald-700 bg-emerald-50 border-emerald-200", alertVariant: "default" as const };
  };

  // Get all documents that need alerts (<= 30 days or expired)
  const alertDocuments = documents.filter(doc => getDaysUntilExpiry(doc.expiry_date) <= 30)
    .sort((a, b) => getDaysUntilExpiry(a.expiry_date) - getDaysUntilExpiry(b.expiry_date));

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Company Documents</h1>
          <p className="text-muted-foreground mt-1">Manage health & safety policies, insurances, and other official documents.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Upload Company Document</DialogTitle>
                <DialogDescription>
                  Add a new official document to the company registry.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Document Title <span className="text-red-500">*</span></Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Public Liability Insurance"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description & Purpose</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Briefly describe what this document is for..."
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expiry_date">Expiry Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="file">File Attachment</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Document
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {alertDocuments.length > 0 && (
        <div className="mb-8 space-y-3">
          {alertDocuments.map((doc) => {
            const days = getDaysUntilExpiry(doc.expiry_date);
            const status = getExpiryStatus(days);
            
            return (
              <Alert key={`alert-${doc.id}`} variant={status.alertVariant} className={`border ${days <= 7 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <AlertCircle className={`h-4 w-4 ${days <= 7 ? 'text-red-600' : 'text-amber-600'}`} />
                <AlertTitle className={`font-semibold ${days <= 7 ? 'text-red-800' : 'text-amber-800'}`}>
                  Document Attention Required: {doc.title}
                </AlertTitle>
                <AlertDescription className={days <= 7 ? 'text-red-700' : 'text-amber-700'}>
                  This document {days < 0 ? 'expired' : 'expires'} on {new Date(doc.expiry_date).toLocaleDateString()} 
                  <strong className="ml-1">({status.label})</strong>. 
                  Please review and upload a renewed version if necessary.
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      <Card className="shadow-sm border-muted">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Document Registry
          </CardTitle>
          <CardDescription>
            A complete log of all active and historical company documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center p-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No Documents Found</h3>
              <p className="text-muted-foreground mb-4">You haven't uploaded any company documents yet.</p>
              <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Document
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Document Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => {
                    const days = getDaysUntilExpiry(doc.expiry_date);
                    const status = getExpiryStatus(days);
                    
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          {doc.title}
                          {doc.filename && (
                            <div className="text-xs text-muted-foreground font-normal mt-1 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> {doc.filename}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {doc.description || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(doc.expiry_date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {doc.file_path && doc.filename && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleDownload(doc.file_path!, doc.filename!)}
                                title="Download Document"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(doc.id, doc.file_path)}
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}