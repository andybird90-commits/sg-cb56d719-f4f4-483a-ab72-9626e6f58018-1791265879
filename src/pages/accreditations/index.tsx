import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { accreditationsService, Accreditation } from "@/services/accreditationsService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInDays, startOfDay, parseISO } from "date-fns";
import { AlertTriangle, Download, Plus, Trash2, BadgeCheck, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AccreditationsPage() {
  const [accreditations, setAccreditations] = useState<Accreditation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    expiry_date: "",
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadAccreditations();
  }, []);

  const loadAccreditations = async () => {
    try {
      setLoading(true);
      const data = await accreditationsService.getAccreditations();
      setAccreditations(data);
    } catch (error: any) {
      toast({
        title: "Error loading accreditations",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.expiry_date) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await accreditationsService.createAccreditation(
        {
          title: formData.title,
          description: formData.description,
          expiry_date: formData.expiry_date,
        },
        file || undefined
      );

      toast({
        title: "Success",
        description: "Accreditation added successfully.",
      });
      
      setFormData({ title: "", description: "", expiry_date: "" });
      setFile(null);
      setIsDialogOpen(false);
      loadAccreditations();
    } catch (error: any) {
      toast({
        title: "Error saving accreditation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, filePath?: string | null) => {
    if (!confirm("Are you sure you want to delete this accreditation?")) return;
    
    try {
      await accreditationsService.deleteAccreditation(id, filePath);
      toast({
        title: "Success",
        description: "Accreditation deleted successfully.",
      });
      loadAccreditations();
    } catch (error: any) {
      toast({
        title: "Error deleting accreditation",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      await accreditationsService.downloadFile(filePath, fileName);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getExpirationStatus = (dateStr: string) => {
    const today = startOfDay(new Date());
    const expiryDate = startOfDay(parseISO(dateStr));
    const daysLeft = differenceInDays(expiryDate, today);

    if (daysLeft < 0) return { label: "Expired", color: "text-red-600 bg-red-100", urgent: true };
    if (daysLeft === 0) return { label: "Expires Today", color: "text-red-600 bg-red-100", urgent: true, exactDay: 0 };
    if (daysLeft <= 7) return { label: `Expires in ${daysLeft} days`, color: "text-orange-600 bg-orange-100", urgent: true, exactDay: 7 };
    if (daysLeft <= 14) return { label: `Expires in ${daysLeft} days`, color: "text-amber-600 bg-amber-100", urgent: true, exactDay: 14 };
    if (daysLeft <= 30) return { label: `Expires in ${daysLeft} days`, color: "text-yellow-600 bg-yellow-100", urgent: true, exactDay: 30 };
    
    return { label: "Valid", color: "text-emerald-700 bg-emerald-100", urgent: false };
  };

  // Filter alerts for 30, 14, 7, and 0 days
  const alerts = accreditations.filter(acc => {
    const status = getExpirationStatus(acc.expiry_date);
    return status.urgent;
  });

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground flex items-center gap-2">
            <BadgeCheck className="w-8 h-8 text-primary" />
            Accreditations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage company accreditations, certifications, and track their expiry dates.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Add Accreditation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Accreditation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title (What it is) *</Label>
                <Input
                  id="title"
                  placeholder="e.g. ISO 9001"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Why it is) *</Label>
                <Textarea
                  id="description"
                  placeholder="Reason or purpose for this accreditation..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date *</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Certificate / Document</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Accreditation
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map(acc => {
            const daysLeft = differenceInDays(startOfDay(parseISO(acc.expiry_date)), startOfDay(new Date()));
            let alertVariant: "default" | "destructive" = "default";
            let title = "";

            if (daysLeft < 0) {
              alertVariant = "destructive";
              title = "Accreditation Expired";
            } else if (daysLeft === 0) {
              alertVariant = "destructive";
              title = "Accreditation Expires Today";
            } else if (daysLeft <= 7) {
              alertVariant = "destructive";
              title = "Accreditation Expiring Soon (7 Days or less)";
            } else if (daysLeft <= 14) {
              alertVariant = "default";
              title = "Accreditation Expiring in 14 Days or less";
            } else if (daysLeft <= 30) {
              alertVariant = "default";
              title = "Accreditation Expiring in 30 Days or less";
            }

            return (
              <Alert key={acc.id} variant={alertVariant} className={alertVariant === "default" ? "border-amber-500 bg-amber-50 text-amber-900" : ""}>
                <AlertTriangle className={`h-4 w-4 ${alertVariant === "default" ? "text-amber-600" : ""}`} />
                <AlertTitle className="font-semibold">{title}</AlertTitle>
                <AlertDescription>
                  <strong>{acc.title}</strong> is set to expire on {format(parseISO(acc.expiry_date), 'dd MMM yyyy')}.
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Accreditation Registry</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : accreditations.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground border rounded-lg bg-muted/20">
              <BadgeCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No accreditations found.</p>
              <p className="text-sm mt-1">Add your first accreditation to start tracking.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accreditations.map((acc) => {
                    const status = getExpirationStatus(acc.expiry_date);
                    return (
                      <TableRow key={acc.id}>
                        <TableCell className="font-medium">{acc.title}</TableCell>
                        <TableCell className="max-w-md truncate" title={acc.description}>
                          {acc.description}
                        </TableCell>
                        <TableCell>{format(parseISO(acc.expiry_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {acc.file_path && acc.filename && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDownload(acc.file_path!, acc.filename!)}
                                title={`Download ${acc.filename}`}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(acc.id, acc.file_path)}
                              title="Delete"
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