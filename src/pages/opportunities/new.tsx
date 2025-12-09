import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

function NewOpportunityContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    company_id: "",
    contact_id: "",
    name: "",
    description: "",
    stage: "bid",
    status: "open",
    tender_due_date: "",
    expected_start_date: "",
    expected_end_date: "",
    expected_fee_value: "",
    probability_percent: "",
    added_by_user_id: "",
  });

  useEffect(() => {
    if (profile && profile.role !== "admin" && profile.role !== "director") {
      router.push("/opportunities");
    }
    fetchCompanies();
    fetchUsers();
  }, [profile, router]);

  useEffect(() => {
    if (formData.company_id) {
      fetchContacts(formData.company_id);
    }
  }, [formData.company_id]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");
    if (data) setCompanies(data);
  };

  const fetchContacts = async (companyId: string) => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");
    if (data) setContacts(data);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");
    if (data) setUsers(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: insertError } = await supabase.from("opportunities").insert({
      company_id: formData.company_id,
      contact_id: formData.contact_id || null,
      name: formData.name,
      description: formData.description || null,
      stage: formData.stage as "secured" | "high_potential" | "bid",
      status: formData.status as "open" | "closed_won" | "closed_lost",
      tender_due_date: formData.tender_due_date || null,
      expected_start_date: formData.expected_start_date || null,
      expected_end_date: formData.expected_end_date || null,
      expected_fee_value: formData.expected_fee_value ? parseFloat(formData.expected_fee_value) : null,
      probability_percent: formData.probability_percent ? parseInt(formData.probability_percent) : null,
      added_by_user_id: formData.added_by_user_id || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/opportunities");
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Link href="/opportunities">
            <Button variant="ghost" size="sm" className="gap-2 self-start">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Add New Opportunity</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Create a new business opportunity</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Opportunity Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm sm:text-base">Opportunity Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="h-10 sm:h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_id" className="text-sm sm:text-base">Client Company *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value, contact_id: "" })}
                >
                  <SelectTrigger className="h-10 sm:h-11">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.company_id && contacts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="contact_id" className="text-sm sm:text-base">Contact</Label>
                  <Select
                    value={formData.contact_id}
                    onValueChange={(value) => setFormData({ ...formData, contact_id: value })}
                  >
                    <SelectTrigger className="h-10 sm:h-11">
                      <SelectValue placeholder="Select a contact (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stage">Stage</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(value) => setFormData({ ...formData, stage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="bid">In Bid</SelectItem>
                      <SelectItem value="high_potential">High Potential</SelectItem>
                      <SelectItem value="secured">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm sm:text-base">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="h-10 sm:h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed_won">Closed Won</SelectItem>
                      <SelectItem value="closed_lost">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected_fee_value" className="text-sm sm:text-base">Expected Fee Value (£)</Label>
                  <Input
                    id="expected_fee_value"
                    type="number"
                    step="0.01"
                    value={formData.expected_fee_value}
                    onChange={(e) => setFormData({ ...formData, expected_fee_value: e.target.value })}
                    className="h-10 sm:h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="probability_percent" className="text-sm sm:text-base">Probability (%)</Label>
                  <Input
                    id="probability_percent"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability_percent}
                    onChange={(e) => setFormData({ ...formData, probability_percent: e.target.value })}
                    className="h-10 sm:h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="added_by_user_id" className="text-sm sm:text-base">Added by</Label>
                <Select
                  value={formData.added_by_user_id}
                  onValueChange={(value) => setFormData({ ...formData, added_by_user_id: value })}
                >
                  <SelectTrigger className="h-10 sm:h-11">
                    <SelectValue placeholder="Select user (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tender_due_date" className="text-sm sm:text-base">Tender Due Date</Label>
                  <Input
                    id="tender_due_date"
                    type="date"
                    value={formData.tender_due_date}
                    onChange={(e) => setFormData({ ...formData, tender_due_date: e.target.value })}
                    className="h-10 sm:h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_start_date" className="text-sm sm:text-base">Expected Start Date</Label>
                  <Input
                    id="expected_start_date"
                    type="date"
                    value={formData.expected_start_date}
                    onChange={(e) => setFormData({ ...formData, expected_start_date: e.target.value })}
                    className="h-10 sm:h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_end_date" className="text-sm sm:text-base">Expected End Date</Label>
                  <Input
                    id="expected_end_date"
                    type="date"
                    value={formData.expected_end_date}
                    onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })}
                    className="h-10 sm:h-11"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={loading} className="h-10 sm:h-11">
                  {loading ? "Creating..." : "Create Opportunity"}
                </Button>
                <Link href="/opportunities" className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full h-10 sm:h-11">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function NewOpportunityPage() {
  return (
    <RequireAuth>
      <NewOpportunityContent />
    </RequireAuth>
  );
}