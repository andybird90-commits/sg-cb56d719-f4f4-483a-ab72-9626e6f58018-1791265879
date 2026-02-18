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
import { Pencil, Save, X, Filter, CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InvoiceHistory {
  id: string;
  client_name: string | null;
  project_name: string | null;
  company_id: string | null;
  project_id: string | null;
  po_reference: string | null;
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
}

interface FormData {
  client_name: string;
  company_id: string;
  project_name: string;
  project_id: string;
  po_reference: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  net_amount: string;
  vat_amount: string;
  status: "unpaid" | "part_paid" | "paid" | "written_off";
  paid_amount: string;
  notes: string;
}

function IntakeInvoicesContent() {
  const [invoices, setInvoices] = useState<InvoiceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Companies and projects data
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; company_id: string }>>([]);
  const [filteredProjects, setFilteredProjects] = useState<Array<{ id: string; name: string }>>([]);
  
  // Combobox open states
  const [companyOpen, setCompanyOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const [formData, setFormData] = useState({
    client_name: "",
    company_id: "",
    project_name: "",
    project_id: "",
    po_reference: "",
    invoice_number: "",
    invoice_date: "",
    due_date: "",
    net_amount: "",
    vat_amount: "0",
    status: "unpaid" as const,
    paid_amount: "0",
    notes: "",
  });

  // Calculate gross amount
  const netAmount = parseFloat(formData.net_amount) || 0;
  const vatAmount = parseFloat(formData.vat_amount) || 0;
  const grossAmount = netAmount + vatAmount;

  // Validation
  const isValid = () => {
    if (!formData.company_id) return false;
    if (!formData.invoice_number.trim()) return false;
    if (!formData.invoice_date) return false;
    if (!formData.due_date) return false;
    if (netAmount < 0) return false;
    if (vatAmount < 0) return false;
    if (formData.due_date < formData.invoice_date) return false;
    return true;
  };

  const [dateError, setDateError] = useState("");

  // Fetch companies and projects
  const fetchCompaniesAndProjects = async () => {
    try {
      const [companiesRes, projectsRes] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("projects").select("id, name, client_company_id").order("name")
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (projectsRes.error) throw projectsRes.error;

      setCompanies(companiesRes.data || []);
      // Map client_company_id to company_id for compatibility
      setProjects((projectsRes.data || []).map(p => ({ ...p, company_id: p.client_company_id })));
    } catch (error) {
      console.error("Error fetching companies/projects:", error);
    }
  };

  // Fetch invoices
  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoice_history")
        .select(`
          *,
          companies!invoice_history_company_id_fkey(name),
          projects!invoice_history_project_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data as InvoiceHistory[]);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompaniesAndProjects();
    fetchInvoices();
  }, []);

  // Filter projects based on selected company
  useEffect(() => {
    if (formData.company_id) {
      const filtered = projects.filter(p => p.company_id === formData.company_id);
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects(projects);
    }
  }, [formData.company_id, projects]);

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

  const handleSubmit = async (saveAndAddAnother: boolean = false) => {
    // Validation
    if (!formData.company_id || !formData.invoice_number || !formData.invoice_date || !formData.due_date || !formData.net_amount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (dateError) {
      toast({
        title: "Validation Error",
        description: dateError,
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedCompany = companies.find(c => c.id === formData.company_id);
      const selectedProject = projects.find(p => p.id === formData.project_id);

      const invoiceData = {
        company_id: formData.company_id,
        client_name: selectedCompany?.name || null,
        project_id: formData.project_id || null,
        project_name: selectedProject?.name || null,
        po_reference: formData.po_reference || null,
        invoice_number: formData.invoice_number,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        net_amount: parseFloat(formData.net_amount),
        vat_amount: parseFloat(formData.vat_amount),
        status: formData.status,
        paid_amount: parseFloat(formData.paid_amount),
        notes: formData.notes || null,
      };

      if (editingId) {
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
        const { error } = await supabase
          .from("invoice_history")
          .insert([invoiceData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Invoice added successfully",
        });
      }

      if (saveAndAddAnother) {
        setFormData({
          client_name: "",
          company_id: "",
          project_name: "",
          project_id: "",
          po_reference: "",
          invoice_number: "",
          invoice_date: "",
          due_date: "",
          net_amount: "",
          vat_amount: "0",
          status: "unpaid",
          paid_amount: "0",
          notes: "",
        });
      }

      fetchInvoices();
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: "Failed to save invoice",
        variant: "destructive",
      });
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

  const handleEdit = (invoice: InvoiceHistory) => {
    setEditingId(invoice.id);
    setFormData({
      client_name: invoice.client_name || "",
      company_id: invoice.company_id || "",
      project_name: invoice.project_name || "",
      project_id: invoice.project_id || "",
      po_reference: invoice.po_reference || "",
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      net_amount: invoice.net_amount.toString(),
      vat_amount: invoice.vat_amount.toString(),
      status: invoice.status,
      paid_amount: invoice.paid_amount.toString(),
      notes: invoice.notes || "",
    });
  };

  // Cancel edit
  const cancelEdit = () => {
    setFormData({
      client_name: "",
      company_id: "",
      project_name: "",
      project_id: "",
      po_reference: "",
      invoice_number: "",
      invoice_date: "",
      due_date: "",
      net_amount: "",
      vat_amount: "0",
      status: "unpaid",
      paid_amount: "0",
      notes: "",
    });
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client_name">
                    Client Name <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={companyOpen}
                        className="w-full justify-between"
                      >
                        {formData.company_id
                          ? companies.find((company) => company.id === formData.company_id)?.name
                          : "Select client..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search client..." />
                        <CommandList>
                          <CommandEmpty>No client found.</CommandEmpty>
                          <CommandGroup>
                            {companies.map((company) => (
                              <CommandItem
                                key={company.id}
                                value={company.name}
                                onSelect={() => {
                                  setFormData({ 
                                    ...formData, 
                                    company_id: company.id,
                                    client_name: company.name,
                                    project_id: "", // Reset project when company changes
                                    project_name: ""
                                  });
                                  setCompanyOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.company_id === company.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {company.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="project_name">Project Name</Label>
                  <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={projectOpen}
                        className="w-full justify-between"
                        disabled={!formData.company_id}
                      >
                        {formData.project_id
                          ? filteredProjects.find((project) => project.id === formData.project_id)?.name
                          : "Select project (optional)"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search project..." />
                        <CommandList>
                          <CommandEmpty>No project found.</CommandEmpty>
                          <CommandGroup>
                            {filteredProjects.map((project) => (
                              <CommandItem
                                key={project.id}
                                value={project.name}
                                onSelect={() => {
                                  setFormData({ 
                                    ...formData, 
                                    project_id: project.id,
                                    project_name: project.name
                                  });
                                  setProjectOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.project_id === project.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {project.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
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
                    onClick={() => handleSubmit(false)}
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
                    onClick={() => handleSubmit(false)}
                    disabled={loading || !isValid()}
                  >
                    Save Invoice
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSubmit(true)}
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
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{(invoice as any).companies?.name || invoice.client_name || "N/A"}</TableCell>
                        <TableCell>{(invoice as any).projects?.name || invoice.project_name || "N/A"}</TableCell>
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
                              onClick={() => handleEdit(invoice)}
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