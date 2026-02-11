import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Calendar } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MonthlyBudget {
  id: string;
  year: number;
  month: number;
  budget_revenue: number;
  budget_cost: number | null;
  overhead: number | null;
  total_staff_cost: number | null;
}

function AdminBudgetsContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formOpen, setFormOpen] = useState(false);
  const [bulkFormOpen, setBulkFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<MonthlyBudget | null>(null);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
    budget_revenue: "",
    budget_cost: "",
    overhead: "",
    total_staff_cost: "",
  });

  const [bulkFormData, setBulkFormData] = useState({
    startYear: new Date().getFullYear().toString(),
    startMonth: (new Date().getMonth() + 1).toString(),
    budgets: Array(13).fill(""),
    costs: Array(13).fill(""),
    overheads: Array(13).fill(""),
    staffCosts: Array(13).fill(""),
  });

  const canEdit = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    if (!user) {
      router.push("/auth/signin");
    } else if (profile && !canEdit) {
      router.push("/dashboard");
    } else if (canEdit) {
      fetchBudgets();
    }
  }, [user, profile, canEdit, router]);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("monthly_budgets")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (fetchError) throw fetchError;

      setBudgets(data || []);
    } catch (err) {
      console.error("Failed to load budgets data", err);
      setError("Failed to load budgets. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingBudget) {
      const { error } = await supabase
        .from("monthly_budgets")
        .update({
          year: parseInt(formData.year),
          month: parseInt(formData.month),
          budget_revenue: parseFloat(formData.budget_revenue),
          budget_cost: formData.budget_cost ? parseFloat(formData.budget_cost) : null,
          overhead: formData.overhead ? parseFloat(formData.overhead) : null,
          total_staff_cost: formData.total_staff_cost ? parseFloat(formData.total_staff_cost) : null,
        })
        .eq("id", editingBudget.id);

      if (error) {
        alert("Error updating budget: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("monthly_budgets")
        .insert({
          year: parseInt(formData.year),
          month: parseInt(formData.month),
          budget_revenue: parseFloat(formData.budget_revenue),
          budget_cost: formData.budget_cost ? parseFloat(formData.budget_cost) : null,
          overhead: formData.overhead ? parseFloat(formData.overhead) : null,
          total_staff_cost: formData.total_staff_cost ? parseFloat(formData.total_staff_cost) : null,
        });

      if (error) {
        alert("Error creating budget: " + error.message);
        return;
      }
    }

    await fetchBudgets();
    setFormOpen(false);
    setEditingBudget(null);
    setFormData({
      year: new Date().getFullYear().toString(),
      month: (new Date().getMonth() + 1).toString(),
      budget_revenue: "",
      budget_cost: "",
      overhead: "",
      total_staff_cost: "",
    });
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const startYear = parseInt(bulkFormData.startYear);
    const startMonth = parseInt(bulkFormData.startMonth);

    const budgetsToInsert = [];

    for (let i = 0; i < 13; i++) {
      const budgetValue = bulkFormData.budgets[i];
      const costValue = bulkFormData.costs[i];
      const overheadValue = bulkFormData.overheads[i];
      const staffCostValue = bulkFormData.staffCosts[i];

      if (!budgetValue || parseFloat(budgetValue) <= 0) continue;

      const date = new Date(startYear, startMonth - 1 + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      budgetsToInsert.push({
        year,
        month,
        budget_revenue: parseFloat(budgetValue),
        budget_cost: costValue ? parseFloat(costValue) : null,
        overhead: overheadValue ? parseFloat(overheadValue) : null,
        total_staff_cost: staffCostValue ? parseFloat(staffCostValue) : null,
      });
    }

    if (budgetsToInsert.length === 0) {
      alert("Please enter at least one budget value");
      return;
    }

    // Delete existing budgets for these months first
    for (const budget of budgetsToInsert) {
      await supabase
        .from("monthly_budgets")
        .delete()
        .eq("year", budget.year)
        .eq("month", budget.month);
    }

    // Insert new budgets
    const { error } = await supabase
      .from("monthly_budgets")
      .insert(budgetsToInsert);

    if (error) {
      alert("Error creating budgets: " + error.message);
      return;
    }

    await fetchBudgets();
    setBulkFormOpen(false);
    setBulkFormData({
      startYear: new Date().getFullYear().toString(),
      startMonth: (new Date().getMonth() + 1).toString(),
      budgets: Array(13).fill(""),
      costs: Array(13).fill(""),
      overheads: Array(13).fill(""),
      staffCosts: Array(13).fill(""),
    });
  };

  const handleEdit = (budget: MonthlyBudget) => {
    setEditingBudget(budget);
    setFormData({
      year: budget.year.toString(),
      month: budget.month.toString(),
      budget_revenue: budget.budget_revenue.toString(),
      budget_cost: budget.budget_cost?.toString() || "",
      overhead: budget.overhead?.toString() || "",
      total_staff_cost: budget.total_staff_cost?.toString() || "",
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this budget entry?")) return;

    const { error } = await supabase
      .from("monthly_budgets")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error deleting budget");
      return;
    }

    await fetchBudgets();
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleDateString("en-GB", { month: "long" });
  };

  const getMonthLabel = (startYear: number, startMonth: number, offset: number) => {
    const date = new Date(startYear, startMonth - 1 + offset, 1);
    return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Monthly Budgets</h1>
            <p className="text-slate-600 mt-1">Set revenue targets, overhead, and staff costs</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin">
              <Button variant="outline">User Management</Button>
            </Link>
            <Dialog open={bulkFormOpen} onOpenChange={setBulkFormOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" onClick={() => {
                  setBulkFormData({
                    startYear: new Date().getFullYear().toString(),
                    startMonth: (new Date().getMonth() + 1).toString(),
                    budgets: Array(13).fill(""),
                    costs: Array(13).fill(""),
                    overheads: Array(13).fill(""),
                    staffCosts: Array(13).fill(""),
                  });
                }}>
                  <Calendar className="w-4 h-4" />
                  13-Month Budget
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Set 13-Month Rolling Budget</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleBulkSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-start-year">Start Year</Label>
                      <Input
                        id="bulk-start-year"
                        type="number"
                        min="2020"
                        max="2100"
                        value={bulkFormData.startYear}
                        onChange={(e) => setBulkFormData({ ...bulkFormData, startYear: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bulk-start-month">Start Month</Label>
                      <Input
                        id="bulk-start-month"
                        type="number"
                        min="1"
                        max="12"
                        value={bulkFormData.startMonth}
                        onChange={(e) => setBulkFormData({ ...bulkFormData, startMonth: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Monthly Budgets (£)</Label>
                    <div className="grid gap-3">
                      <div className="grid grid-cols-[120px_1fr_1fr_1fr_1fr] gap-2 items-center font-medium text-sm text-slate-600">
                        <div>Month</div>
                        <div>Revenue</div>
                        <div>Cost</div>
                        <div>Overhead</div>
                        <div>Staff Cost</div>
                      </div>
                      {Array.from({ length: 13 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[120px_1fr_1fr_1fr_1fr] gap-2 items-center">
                          <div className="text-sm font-medium text-slate-700">
                            {getMonthLabel(
                              parseInt(bulkFormData.startYear),
                              parseInt(bulkFormData.startMonth),
                              i
                            )}
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Revenue"
                            value={bulkFormData.budgets[i]}
                            onChange={(e) => {
                              const newBudgets = [...bulkFormData.budgets];
                              newBudgets[i] = e.target.value;
                              setBulkFormData({ ...bulkFormData, budgets: newBudgets });
                            }}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Cost"
                            value={bulkFormData.costs[i]}
                            onChange={(e) => {
                              const newCosts = [...bulkFormData.costs];
                              newCosts[i] = e.target.value;
                              setBulkFormData({ ...bulkFormData, costs: newCosts });
                            }}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Overhead"
                            value={bulkFormData.overheads[i]}
                            onChange={(e) => {
                              const newOverheads = [...bulkFormData.overheads];
                              newOverheads[i] = e.target.value;
                              setBulkFormData({ ...bulkFormData, overheads: newOverheads });
                            }}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Staff Cost"
                            value={bulkFormData.staffCosts[i]}
                            onChange={(e) => {
                              const newStaffCosts = [...bulkFormData.staffCosts];
                              newStaffCosts[i] = e.target.value;
                              setBulkFormData({ ...bulkFormData, staffCosts: newStaffCosts });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit">Save All Budgets</Button>
                    <Button type="button" variant="outline" onClick={() => setBulkFormOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => {
                  setEditingBudget(null);
                  setFormData({
                    year: new Date().getFullYear().toString(),
                    month: (new Date().getMonth() + 1).toString(),
                    budget_revenue: "",
                    budget_cost: "",
                    overhead: "",
                    total_staff_cost: "",
                  });
                }}>
                  <Plus className="w-4 h-4" />
                  New Budget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingBudget ? "Edit Budget" : "New Monthly Budget"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year *</Label>
                      <Input
                        id="year"
                        type="number"
                        min="2020"
                        max="2100"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="month">Month *</Label>
                      <Input
                        id="month"
                        type="number"
                        min="1"
                        max="12"
                        value={formData.month}
                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget_revenue">Revenue Budget (£) *</Label>
                    <Input
                      id="budget_revenue"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.budget_revenue}
                      onChange={(e) => setFormData({ ...formData, budget_revenue: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget_cost">Cost Budget (£)</Label>
                    <Input
                      id="budget_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.budget_cost}
                      onChange={(e) => setFormData({ ...formData, budget_cost: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="overhead">Monthly Overhead (£)</Label>
                    <Input
                      id="overhead"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.overhead}
                      onChange={(e) => setFormData({ ...formData, overhead: e.target.value })}
                      placeholder="Fixed monthly overhead costs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total_staff_cost">Total Staff Cost (£)</Label>
                    <Input
                      id="total_staff_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.total_staff_cost}
                      onChange={(e) => setFormData({ ...formData, total_staff_cost: e.target.value })}
                      placeholder="Total monthly staff budget"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit">
                      {editingBudget ? "Update" : "Create"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Budget Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-600">
                Loading budgets...
              </div>
            ) : error ? (
              <Alert variant="destructive" className="my-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : budgets.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No budget entries yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {budgets.map((budget) => (
                  <div key={budget.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 mb-3">
                          {getMonthName(budget.month)} {budget.year}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm text-slate-500">Revenue Budget</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {formatCurrency(budget.budget_revenue)}
                            </div>
                          </div>
                          {budget.budget_cost !== null && (
                            <div>
                              <div className="text-sm text-slate-500">Cost Budget</div>
                              <div className="text-lg font-semibold text-slate-900">
                                {formatCurrency(budget.budget_cost)}
                              </div>
                            </div>
                          )}
                          {budget.overhead !== null && (
                            <div>
                              <div className="text-sm text-slate-500">Overhead</div>
                              <div className="text-lg font-semibold text-slate-900">
                                {formatCurrency(budget.overhead)}
                              </div>
                            </div>
                          )}
                          {budget.total_staff_cost !== null && (
                            <div>
                              <div className="text-sm text-slate-500">Total Staff Cost</div>
                              <div className="text-lg font-semibold text-slate-900">
                                {formatCurrency(budget.total_staff_cost)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(budget)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(budget.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function AdminBudgetsPage() {
  return (
    <RequireAuth>
      <AdminBudgetsContent />
    </RequireAuth>
  );
}