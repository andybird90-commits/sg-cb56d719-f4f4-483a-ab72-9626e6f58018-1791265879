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
import { Plus, Edit, Trash2 } from "lucide-react";

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
  const { user } = useAuth();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [formData, setFormData] = useState({
    type: "holiday",
    start_date: "",
    end_date: "",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      fetchAbsences();
    }
  }, [user]);

  const fetchAbsences = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("absences")
      .select(`
        *,
        profiles!absences_approved_by_fkey (
          full_name
        )
      `)
      .eq("user_id", user.id)
      .order("start_date", { ascending: false });

    setAbsences(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingAbsence) {
      const { error } = await supabase
        .from("absences")
        .update({
          type: formData.type,
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
          type: formData.type,
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
    if (approved_by) {
      alert("Cannot delete approved absences");
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Absences</h1>
            <p className="text-slate-600 mt-1">Request and manage time off</p>
          </div>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => {
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
            <DialogContent>
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="flex gap-3">
                  <Button type="submit">
                    {editingAbsence ? "Update" : "Submit Request"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Absence Requests</CardTitle>
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
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getTypeColor(absence.type)}>
                            {absence.type}
                          </Badge>
                          {absence.approved_by ? (
                            <Badge className="bg-green-100 text-green-800">
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
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
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(absence)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(absence.id, absence.approved_by)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
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