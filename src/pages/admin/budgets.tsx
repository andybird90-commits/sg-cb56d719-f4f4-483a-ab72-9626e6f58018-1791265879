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
import { Plus, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MonthlyBudget {
  id: string;
  year: number;
  month: number;
  budget_revenue: number;
  budget_cost: number | null;
}

function AdminBudgetsContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<MonthlyBudget | null>(null);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
    budget_revenue: "",
    budget_cost: "",
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
    });
  };

  const handleEdit = (budget: MonthlyBudget) => {
    setEditingBudget(budget);
    setFormData({
      year: budget.year.toString(),
      month: budget.month.toString(),
      budget_revenue: budget.budget_revenue.toString(),
      budget_cost: budget.budget_cost?.toString() || "",
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Monthly Budgets</h1>
            <p className="text-slate-600 mt-1">Set revenue and cost targets</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin">
              <Button variant="outline">User Management</Button>
            </Link>
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => {
                  setEditingBudget(null);
                  setFormData({
                    year: new Date().getFullYear().toString(),
                    month: (new Date().getMonth() + 1).toString(),
                    budget_revenue: "",
                    budget_cost: "",
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
                    <Label htmlFor="budget_revenue">Budget (£) *</Label>
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
                    <Label htmlFor="budget_cost">Budget Cost (£)</Label>
                    <Input
                      id="budget_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.budget_cost}
                      onChange={(e) => setFormData({ ...formData, budget_cost: e.target.value })}
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
                        <div className="font-medium text-slate-900 mb-2">
                          {getMonthName(budget.month)} {budget.year}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-slate-500">Budget</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {formatCurrency(budget.budget_revenue)}
                            </div>
                          </div>
                          {budget.budget_cost && (
                            <div>
                              <div className="text-sm text-slate-500">Cost Budget</div>
                              <div className="text-lg font-semibold text-slate-900">
                                {formatCurrency(budget.budget_cost)}
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