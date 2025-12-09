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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Users } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  default_hourly_cost_rate: number | null;
  annual_holiday_days: number;
  holiday_cost_rate: number | null;
  is_active: boolean;
}

function AdminContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    role: "user",
    default_hourly_cost_rate: "",
    annual_holiday_days: "",
    holiday_cost_rate: "",
    is_active: true,
  });

  const canEdit = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    if (!user) {
      router.push("/auth/signin");
    } else if (profile && !canEdit) {
      router.push("/dashboard");
    } else if (canEdit) {
      fetchUsers();
    }
  }, [user, profile, canEdit, router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (fetchError) throw fetchError;

      // Cast to Profile[] as generated types might not have new columns yet
      setUsers((data as unknown as Profile[]) || []);
    } catch (err) {
      console.error("Failed to load users data", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      role: user.role,
      default_hourly_cost_rate: user.default_hourly_cost_rate?.toString() || "",
      annual_holiday_days: user.annual_holiday_days.toString(),
      holiday_cost_rate: user.holiday_cost_rate?.toString() || "",
      is_active: user.is_active,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        role: formData.role as "admin" | "director" | "user",
        default_hourly_cost_rate: formData.default_hourly_cost_rate ? parseFloat(formData.default_hourly_cost_rate) : null,
        annual_holiday_days: formData.annual_holiday_days ? parseInt(formData.annual_holiday_days) : 0,
        holiday_cost_rate: formData.holiday_cost_rate ? parseFloat(formData.holiday_cost_rate) : null,
        is_active: formData.is_active,
      })
      .eq("id", editingUser.id);

    if (error) {
      alert("Error updating user: " + error.message);
      return;
    }

    await fetchUsers();
    setFormOpen(false);
    setEditingUser(null);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "director":
        return "bg-blue-100 text-blue-800";
      case "user":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Admin Panel</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Manage users and system settings</p>
          </div>
          <Link href="/admin/budgets">
            <Button variant="outline" className="w-full sm:w-auto">Monthly Budgets</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-600" />
                <CardTitle className="text-base sm:text-lg">User Management</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-600">
                Loading users...
              </div>
            ) : error ? (
              <Alert variant="destructive" className="my-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No users found.
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div key={u.id} className="p-4 border rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <div className="font-medium text-sm sm:text-base text-slate-900">
                            {u.full_name}
                          </div>
                          <Badge className={getRoleBadgeColor(u.role)}>
                            {u.role}
                          </Badge>
                          {!u.is_active && (
                            <Badge variant="outline" className="text-red-600">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 mb-2 break-all">
                          {u.email}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-slate-500">Hourly Rate:</span>{" "}
                            <span className="font-medium">{formatCurrency(u.default_hourly_cost_rate)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Holiday Days:</span>{" "}
                            <span className="font-medium">{u.annual_holiday_days} days</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-slate-500">Holiday Rate:</span>{" "}
                            <span className="font-medium">{formatCurrency(u.holiday_cost_rate)}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(u)} className="w-full sm:w-auto">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>User</Label>
                  <div className="text-sm text-slate-900">
                    <div className="font-medium break-all">{editingUser.full_name}</div>
                    <div className="text-slate-600 break-all">{editingUser.email}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
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
                  <Label htmlFor="default_hourly_cost_rate">Default Hourly Cost Rate (£)</Label>
                  <Input
                    id="default_hourly_cost_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.default_hourly_cost_rate}
                    onChange={(e) => setFormData({ ...formData, default_hourly_cost_rate: e.target.value })}
                    placeholder="e.g., 45.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="annual_holiday_days">Annual Holiday Days</Label>
                  <Input
                    id="annual_holiday_days"
                    type="number"
                    min="0"
                    value={formData.annual_holiday_days}
                    onChange={(e) => setFormData({ ...formData, annual_holiday_days: e.target.value })}
                    placeholder="e.g., 25"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holiday_cost_rate">Holiday Cost Rate (£/day)</Label>
                  <Input
                    id="holiday_cost_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.holiday_cost_rate}
                    onChange={(e) => setFormData({ ...formData, holiday_cost_rate: e.target.value })}
                    placeholder="e.g., 360.00"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Active User
                  </Label>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" className="w-full sm:w-auto">Save Changes</Button>
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminContent />
    </RequireAuth>
  );
}