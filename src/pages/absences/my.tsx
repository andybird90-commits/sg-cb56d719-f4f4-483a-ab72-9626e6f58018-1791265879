import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Calendar, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

interface Absence {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  approved_by: string | null;
  profiles?: {
    full_name: string;
  };
}

function MyAbsencesContent() {
  const { user, profile } = useAuth();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [holidayStats, setHolidayStats] = useState({
    annual: 0,
    taken: 0,
    remaining: 0,
  });
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [formData, setFormData] = useState({
    type: "holiday",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const canDelete = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    if (user && profile) {
      fetchAbsences();
      calculateHolidayBalance();
    }
  }, [user, profile]);

  const fetchAbsences = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("absences")
        .select(`
          *,
          profiles!absences_approved_by_fkey (
            full_name
          )
        `)
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });

      if (fetchError) throw fetchError;

      const absencesList = data || [];
      setAbsences(absencesList);
      
      const pending = absencesList.filter(a => a.approved_by === null).length;
      setPendingCount(pending);
    } catch (err) {
      console.error("Failed to load absences data", err);
      setError("Failed to load absences");
    } finally {
      setLoading(false);
    }
  };

  const calculateHolidayBalance = async () => {
    if (!user || !profile) return;

    try {
      const currentYear = new Date().getFullYear();
      const annual = (profile as any).annual_holiday_days || 0;

      const { data: holidays, error: fetchError } = await supabase
        .from("absences")
        .select("start_date, end_date")
        .eq("user_id", user.id)
        .eq("type", "holiday")
        .not("approved_by", "is", null)
        .gte("start_date", `${currentYear}-01-01`)
        .lte("start_date", `${currentYear}-12-31`);

      if (fetchError) throw fetchError;

      let taken = 0;
      if (holidays) {
        holidays.forEach((holiday) => {
          const start = new Date(holiday.start_date);
          const end = new Date(holiday.end_date);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          taken += days;
        });
      }

      setHolidayStats({
        annual,
        taken,
        remaining: annual - taken,
      });
    } catch (err) {
      console.error("Failed to calculate holiday balance", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingAbsence) {
      const { error } = await supabase
        .from("absences")
        .update({
          type: formData.type as "holiday" | "sick" | "other",
          start_date: formData.start_date,
          end_date: formData.end_date,
          notes: formData.notes || null,
        })
        .eq("id", editingAbsence.id);

      if (error) {
        alert("Error updating absence");
        return;
      }
    } else {
      const { error } = await supabase
        .from("absences")
        .insert({
          user_id: user.id,
          type: formData.type as "holiday" | "sick" | "other",
          start_date: formData.start_date,
          end_date: formData.end_date,
          notes: formData.notes || null,
        });

      if (error) {
        alert("Error creating absence");
        return;
      }
    }

    await fetchAbsences();
    await calculateHolidayBalance();
    setFormOpen(false);
    setEditingAbsence(null);
    setFormData({
      type: "holiday",
      start_date: "",
      end_date: "",
      notes: "",
    });
  };

  const handleEdit = (absence: Absence) => {
    if (absence.approved_by) {
      alert("Cannot edit approved absences");
      return;
    }

    setEditingAbsence(absence);
    setFormData({
      type: absence.type,
      start_date: absence.start_date,
      end_date: absence.end_date,
      notes: absence.notes || "",
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: string, approved_by: string | null) => {
    if (!canDelete) {
      alert("Only directors and admins can delete absences");
      return;
    }

    if (!confirm("Delete this absence request?")) return;

    const { error } = await supabase
      .from("absences")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error deleting absence");
      return;
    }

    await fetchAbsences();
    await calculateHolidayBalance();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "holiday":
        return "bg-blue-100 text-blue-800";
      case "sick":
        return "bg-red-100 text-red-800";
      case "other":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">My Absences</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Request and manage time off</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {(profile?.role === "admin" || profile?.role === "director") && (
              <Link href="/absences/heatmap">
                <Button variant="outline" className="w-full sm:w-auto gap-2">
                  <Calendar className="w-4 h-4" />
                  Team Heatmap
                </Button>
              </Link>
            )}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto gap-2" onClick={() => {
                  setEditingAbsence(null);
                  setFormData({
                    type: "holiday",
                    start_date: "",
                    end_date: "",
                    notes: "",
                  });
                }}>
                  <Plus className="w-4 h-4" />
                  Request Absence
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingAbsence ? "Edit Absence" : "Request Absence"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="holiday">Holiday</SelectItem>
                        <SelectItem value="sick">Sick</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date *</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date *</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button type="submit" className="w-full sm:w-auto">
                      {editingAbsence ? "Update" : "Submit Request"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Pending Approvals Alert */}
        {pendingCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Pending approvals: {pendingCount}</strong>
              {pendingCount === 1 
                ? " - You have 1 absence request awaiting approval."
                : ` - You have ${pendingCount} absence requests awaiting approval.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Holiday Balance Card - Mobile optimized */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Holiday Balance ({new Date().getFullYear()})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-slate-500 mb-1">Annual Entitlement</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{holidayStats.annual} days</div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Approved & Taken</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-600">{holidayStats.taken} days</div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Remaining</div>
                <div className={`text-xl sm:text-2xl font-bold ${holidayStats.remaining < 5 ? "text-red-600" : "text-green-600"}`}>
                  {holidayStats.remaining} days
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              * Only approved holidays count towards your balance. Pending requests are shown below.
            </div>
          </CardContent>
        </Card>

        {/* Absence Requests - Card based on all screens */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Absence Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {absences.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No absence requests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {absences.map((absence) => (
                  <div key={absence.id} className="p-4 border rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className={getTypeColor(absence.type)}>
                            {absence.type}
                          </Badge>
                          {absence.approved_by ? (
                            <Badge className="bg-green-100 text-green-800">
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              Pending approval
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-slate-900 mb-1">
                          {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                        </div>
                        {absence.notes && (
                          <div className="text-sm text-slate-600 whitespace-pre-wrap">
                            {absence.notes}
                          </div>
                        )}
                        {absence.approved_by && absence.profiles && (
                          <div className="text-xs text-slate-500 mt-2">
                            Approved by {absence.profiles.full_name}
                          </div>
                        )}
                      </div>
                      {!absence.approved_by && (
                        <div className="flex flex-row sm:flex-col gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(absence)} className="flex-1 sm:flex-none">
                            <Edit className="w-4 h-4" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(absence.id, absence.approved_by)} className="flex-1 sm:flex-none">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      )}
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

export default function MyAbsencesPage() {
  return (
    <RequireAuth>
      <MyAbsencesContent />
    </RequireAuth>
  );
}