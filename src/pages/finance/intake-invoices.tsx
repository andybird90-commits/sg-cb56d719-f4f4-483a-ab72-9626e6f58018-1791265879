import { useState, useEffect } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Pencil, Save, X, Filter } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface InvoiceHistory {
  id: string;
  client_name: string;
  project_name: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  status: "unpaid" | "part_paid" | "paid" | "written_off";
  paid_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
  client_name: string;
  project_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  net_amount: string;
  vat_amount: string;
  status: "unpaid" | "part_paid" | "paid" | "written_off";
  paid_amount: string;
  notes: string;
}

const initialFormData: FormData = {
  client_name: "",
  project_name: "",
  invoice_number: "",
  invoice_date: "",
  due_date: "",
  net_amount: "",
  vat_amount: "0",
  status: "unpaid",
  paid_amount: "0",
  notes: "",
};

function IntakeInvoicesContent() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [invoices, setInvoices] = useState<InvoiceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);

  // Calculate gross amount
  const netAmount = parseFloat(formData.net_amount) || 0;
  const vatAmount = parseFloat(formData.vat_amount) || 0;
  const grossAmount = netAmount + vatAmount;

  // Validation
  const isValid = () => {
    if (!formData.client_name.trim()) return false;
    if (!formData.invoice_number.trim()) return false;
    if (!formData.invoice_date) return false;
    if (!formData.due_date) return false;
    if (netAmount < 0) return false;
    if (vatAmount < 0) return false;
    if (formData.due_date < formData.invoice_date) return false;
    return true;
  };

  // Fetch invoices
  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoice_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Calculate summary metrics
  const unpaidInvoices = invoices.filter((inv) => inv.status === "unpaid");
  const totalOutstanding = unpaidInvoices.reduce(
    (sum, inv) => sum + Number(inv.gross_amount),
    0
  );

  // Filter invoices
  const displayedInvoices = showUnpaidOnly
    ? unpaidInvoices
    : invoices;

  // Save invoice
  const saveInvoice = async (clearForm: boolean = false) => {
    if (!isValid()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const invoiceData = {
        client_name: formData.client_name.trim(),
        project_name: formData.project_name.trim() || null,
        invoice_number: formData.invoice_number.trim(),
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        net_amount: netAmount,
        vat_amount: vatAmount,
        status: formData.status,
        paid_amount: parseFloat(formData.paid_amount) || 0,
        notes: formData.notes.trim() || null,
      };

      if (editingId) {
        // Update existing invoice
        const { error } = await supabase
          .from("invoice_history")
          .update(invoiceData)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Invoice updated successfully",
        });
        setEditingId(null);
      } else {
        // Insert new invoice
        const { error } = await supabase
          .from("invoice_history")
          .insert(invoiceData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Invoice saved successfully",
        });
      }

      if (clearForm) {
        setFormData(initialFormData);
      }

      fetchInvoices();
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: "Failed to save invoice",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Edit invoice
  const editInvoice = (invoice: InvoiceHistory) => {
    setFormData({
      client_name: invoice.client_name,
      project_name: invoice.project_name || "",
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      net_amount: invoice.net_amount.toString(),
      vat_amount: invoice.vat_amount.toString(),
      status: invoice.status,
      paid_amount: invoice.paid_amount.toString(),
      notes: invoice.notes || "",
    });
    setEditingId(invoice.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cancel edit
  const cancelEdit = () => {
    setFormData(initialFormData);
    setEditingId(null);
  };

  // Delete invoice
  const deleteInvoice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    try {
      const { error } = await supabase
        .from("invoice_history")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });

      fetchInvoices();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      unpaid: "destructive",
      part_paid: "secondary",
      paid: "default",
      written_off: "outline",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Invoice Intake</h1>
          <p className="text-slate-600 mt-1">
            Manual entry of historical and outstanding invoices
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Outstanding (Gross)</CardDescription>
              <CardTitle className="text-3xl">
                £{totalOutstanding.toLocaleString("en-GB", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Unpaid Invoices</CardDescription>
              <CardTitle className="text-3xl">{unpaidInvoices.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Edit Invoice" : "Add New Invoice"}
            </CardTitle>
            <CardDescription>
              Enter invoice details below. All amounts should be in GBP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Name */}
              <div className="space-y-2">
                <Label htmlFor="client_name">
                  Client Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  placeholder="Enter client name"
                />
              </div>

              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="project_name">Project Name</Label>
                <Input
                  id="project_name"
                  value={formData.project_name}
                  onChange={(e) =>
                    setFormData({ ...formData, project_name: e.target.value })
                  }
                  placeholder="Enter project name (optional)"
                />
              </div>

              {/* Invoice Number */}
              <div className="space-y-2">
                <Label htmlFor="invoice_number">
                  Invoice Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_number: e.target.value })
                  }
                  placeholder="INV-001"
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="part_paid">Part Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="written_off">Written Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Invoice Date */}
              <div className="space-y-2">
                <Label htmlFor="invoice_date">
                  Invoice Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_date: e.target.value })
                  }
                />
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due_date">
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                  min={formData.invoice_date}
                />
                {formData.due_date &&
                  formData.invoice_date &&
                  formData.due_date < formData.invoice_date && (
                    <p className="text-sm text-red-500">
                      Due date must be on or after invoice date
                    </p>
                  )}
              </div>

              {/* Net Amount */}
              <div className="space-y-2">
                <Label htmlFor="net_amount">
                  Net Amount (£) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="net_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.net_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, net_amount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              {/* VAT Amount */}
              <div className="space-y-2">
                <Label htmlFor="vat_amount">VAT Amount (£)</Label>
                <Input
                  id="vat_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.vat_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, vat_amount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              {/* Gross Amount (calculated) */}
              <div className="space-y-2">
                <Label>Gross Amount (£)</Label>
                <div className="text-2xl font-bold text-green-600">
                  £{grossAmount.toFixed(2)}
                </div>
                <p className="text-sm text-slate-500">
                  Net + VAT (auto-calculated)
                </p>
              </div>

              {/* Paid Amount */}
              <div className="space-y-2">
                <Label htmlFor="paid_amount">Paid Amount (£)</Label>
                <Input
                  id="paid_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={grossAmount}
                  value={formData.paid_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, paid_amount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes about this invoice..."
                  rows={3}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-6">
              {editingId ? (
                <>
                  <Button
                    onClick={() => saveInvoice(false)}
                    disabled={loading || !isValid()}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Update Invoice
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={loading}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => saveInvoice(false)}
                    disabled={loading || !isValid()}
                  >
                    Save Invoice
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => saveInvoice(true)}
                    disabled={loading || !isValid()}
                  >
                    Save + Add Another
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recently Added Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>Recently added invoices</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">Unpaid only</span>
                <Switch
                  checked={showUnpaidOnly}
                  onCheckedChange={setShowUnpaidOnly}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                        {showUnpaidOnly
                          ? "No unpaid invoices found"
                          : "No invoices added yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>{invoice.client_name}</TableCell>
                        <TableCell>{invoice.project_name || "-"}</TableCell>
                        <TableCell>
                          {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.due_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          £{Number(invoice.net_amount).toLocaleString("en-GB", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          £{Number(invoice.vat_amount).toLocaleString("en-GB", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          £{Number(invoice.gross_amount).toLocaleString("en-GB", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => editInvoice(invoice)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteInvoice(invoice.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function IntakeInvoicesPage() {
  return (
    <RequireAuth>
      <IntakeInvoicesContent />
    </RequireAuth>
  );
}