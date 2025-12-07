import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Profile, MonthlyBudget } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Users, DollarSign } from "lucide-react";

export default function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  
  // User edit form
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userFormData, setUserFormData] = useState({
    role: "user" as "admin" | "director" | "user",
    default_hourly_cost_rate: "",
    is_active: true,
  });

  // Budget form
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<MonthlyBudget | null>(null);
  const [budgetFormData, setBudgetFormData] = useState({
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
    budget_revenue: "",
    budget_cost: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    } else if (!authLoading && profile && profile.role !== "admin" && profile.role !== "director") {
      router.push("/dashboard");
    } else if (user && (profile?.role === "admin" || profile?.role === "director")) {
      fetchData();
    }
  }, [user, profile, authLoading, router]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");

    if (profilesData) setProfiles(profilesData);

    // Fetch budgets
    const { data: budgetsData } = await supabase
      .from("monthly_budgets")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (budgetsData) setBudgets(budgetsData);

    setLoading(false);
  };

  // User management handlers
  const openUserForm = (userProfile: Profile) => {
    setEditingUser(userProfile);
    setUserFormData({
      role: userProfile.role,
      default_hourly_cost_rate: userProfile.default_hourly_cost_rate?.toString() || "",
      is_active: userProfile.is_active,
    });
    setUserDialogOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        role: userFormData.role,
        default_hourly_cost_rate: userFormData.default_hourly_cost_rate 
          ? parseFloat(userFormData.default_hourly_cost_rate) 
          : null,
        is_active: userFormData.is_active,
      })
      .eq("id", editingUser.id);

    if (!error) {
      setUserDialogOpen(false);
      setEditingUser(null);
      fetchData();
    }
  };

  // Budget management handlers
  const openBudgetForm = (budget?: MonthlyBudget) => {
    if (budget) {
      setEditingBudget(budget);
      setBudgetFormData({
        year: budget.year.toString(),
        month: budget.month.toString(),
        budget_revenue: budget.budget_revenue.toString(),
        budget_cost: budget.budget_cost?.toString() || "",
      });
    } else {
      setEditingBudget(null);
      setBudgetFormData({
        year: new Date().getFullYear().toString(),
        month: (new Date().getMonth() + 1).toString(),
        budget_revenue: "",
        budget_cost: "",
      });
    }
    setBudgetDialogOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    const budgetData = {
      year: parseInt(budgetFormData.year),
      month: parseInt(budgetFormData.month),
      budget_revenue: parseFloat(budgetFormData.budget_revenue),
      budget_cost: budgetFormData.budget_cost ? parseFloat(budgetFormData.budget_cost) : null,
    };

    if (editingBudget) {
      const { error } = await supabase
        .from("monthly_budgets")
        .update(budgetData)
        .eq("id", editingBudget.id);

      if (!error) {
        setBudgetDialogOpen(false);
        setEditingBudget(null);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("monthly_budgets")
        .insert(budgetData);

      if (!error) {
        setBudgetDialogOpen(false);
        fetchData();
      }
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm("Delete this budget entry?")) return;

    const { error } = await supabase
      .from("monthly_budgets")
      .delete()
      .eq("id", budgetId);

    if (!error) {
      fetchData();
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "director":
        return "bg-blue-100 text-blue-800";
      case "user":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

  if (authLoading || loading) {
    return <Layout>Loading...</Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
          <p className="text-slate-600 mt-1">Manage users and budgets</p>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="budgets">Budget Management</TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Hourly Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((userProfile) => (
                      <TableRow key={userProfile.id}>
                        <TableCell className="font-medium">
                          {userProfile.full_name}
                        </TableCell>
                        <TableCell>{userProfile.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(userProfile.role)}>
                            {userProfile.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(userProfile.default_hourly_cost_rate)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              userProfile.is_active
                                ? "bg-green-100 text-green-800"
                                : "bg-slate-100 text-slate-800"
                            }
                          >
                            {userProfile.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openUserForm(userProfile)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Budget Management Tab */}
          <TabsContent value="budgets">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Monthly Budgets
                </CardTitle>
                <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" onClick={() => openBudgetForm()}>
                      <Plus className="w-4 h-4" />
                      Add Budget
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingBudget ? "Edit Budget" : "Add New Budget"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveBudget} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Year</Label>
                          <Select
                            value={budgetFormData.year}
                            onValueChange={(value) =>
                              setBudgetFormData({ ...budgetFormData, year: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {years.map((y) => (
                                <SelectItem key={y} value={y.toString()}>
                                  {y}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Month</Label>
                          <Select
                            value={budgetFormData.month}
                            onValueChange={(value) =>
                              setBudgetFormData({ ...budgetFormData, month: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {months.map((m) => (
                                <SelectItem key={m.value} value={m.value.toString()}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Budget Revenue (£)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={budgetFormData.budget_revenue}
                          onChange={(e) =>
                            setBudgetFormData({
                              ...budgetFormData,
                              budget_revenue: e.target.value,
                            })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Budget Cost (£)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={budgetFormData.budget_cost}
                          onChange={(e) =>
                            setBudgetFormData({
                              ...budgetFormData,
                              budget_cost: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button type="submit">
                          {editingBudget ? "Save Changes" : "Add Budget"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setBudgetDialogOpen(false);
                            setEditingBudget(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {budgets.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No budgets configured yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Budget Revenue</TableHead>
                        <TableHead className="text-right">Budget Cost</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgets.map((budget) => (
                        <TableRow key={budget.id}>
                          <TableCell className="font-medium">
                            {months.find((m) => m.value === budget.month)?.label}{" "}
                            {budget.year}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(budget.budget_revenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(budget.budget_cost)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openBudgetForm(budget)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBudget(budget.id)}
                              >
                                <span className="text-red-600">×</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* User Edit Dialog */}
        <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser?.full_name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={userFormData.role}
                  onValueChange={(value: "admin" | "director" | "user") =>
                    setUserFormData({ ...userFormData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Hourly Cost Rate (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={userFormData.default_hourly_cost_rate}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      default_hourly_cost_rate: e.target.value,
                    })
                  }
                  placeholder="Enter hourly rate"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={userFormData.is_active}
                  onCheckedChange={(checked) =>
                    setUserFormData({ ...userFormData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active User</Label>
              </div>

              <div className="flex gap-3">
                <Button type="submit">Save Changes</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setUserDialogOpen(false);
                    setEditingUser(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}