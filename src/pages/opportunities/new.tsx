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

function NewOpportunityContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
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
  });

  useEffect(() => {
    if (profile && profile.role !== "admin" && profile.role !== "director") {
      router.push("/opportunities");
    }
    fetchCompanies();
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
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/opportunities">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Add New Opportunity</h1>
            <p className="text-slate-600 mt-1">Create a new business opportunity</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Opportunity Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Opportunity Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_id">Client Company *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value, contact_id: "" })}
                >
                  <SelectTrigger>
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
                  <Label htmlFor="contact_id">Contact</Label>
                  <Select
                    value={formData.contact_id}
                    onValueChange={(value) => setFormData({ ...formData, contact_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a contact (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                      <SelectItem value="secured">Secured</SelectItem>
                      <SelectItem value="high_potential">High Potential</SelectItem>
                      <SelectItem value="bid">Bid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected_fee_value">Expected Fee Value (£)</Label>
                  <Input
                    id="expected_fee_value"
                    type="number"
                    step="0.01"
                    value={formData.expected_fee_value}
                    onChange={(e) => setFormData({ ...formData, expected_fee_value: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="probability_percent">Probability (%)</Label>
                  <Input
                    id="probability_percent"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability_percent}
                    onChange={(e) => setFormData({ ...formData, probability_percent: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tender_due_date">Tender Due Date</Label>
                  <Input
                    id="tender_due_date"
                    type="date"
                    value={formData.tender_due_date}
                    onChange={(e) => setFormData({ ...formData, tender_due_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_start_date">Expected Start Date</Label>
                  <Input
                    id="expected_start_date"
                    type="date"
                    value={formData.expected_start_date}
                    onChange={(e) => setFormData({ ...formData, expected_start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_end_date">Expected End Date</Label>
                  <Input
                    id="expected_end_date"
                    type="date"
                    value={formData.expected_end_date}
                    onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Opportunity"}
                </Button>
                <Link href="/opportunities">
                  <Button type="button" variant="outline">
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