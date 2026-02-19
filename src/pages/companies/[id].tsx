import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, AlertTriangle, Edit, Trash2, Linkedin } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Company {
  id: string;
  name: string;
  short_name?: string | null;
  address?: string | null;
  vat_number?: string | null;
  company_number?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  accounts_email?: string | null;
  notes?: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
}

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  status: string;
  expected_fee_value: number | null;
}

function CompanyDetailContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  
  const [company, setCompany] = useState<Company | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    address: "",
    vat_number: "",
    company_number: "",
    website: "",
    linkedin_url: "",
    accounts_email: "",
    notes: "",
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companyError, setCompanyError] = useState<string | null>(null);
  
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);

  const canEdit = !!profile;
  const canDelete = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchCompanyData(id);
      fetchContactsData(id);
      fetchOpportunitiesData(id);
    }
  }, [id]);

  const fetchCompanyData = async (companyId: string) => {
    try {
      setCompanyLoading(true);
      setCompanyError(null);

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Company not found");
      
      const companyData = data as Company;
      setCompany(companyData);
      setFormData({
        name: companyData.name,
        short_name: companyData.short_name || "",
        address: companyData.address || "",
        vat_number: companyData.vat_number || "",
        company_number: companyData.company_number || "",
        website: companyData.website || "",
        linkedin_url: companyData.linkedin_url || "",
        accounts_email: companyData.accounts_email || "",
        notes: companyData.notes || "",
      });
    } catch (err) {
      console.error("Failed to load company data", err);
      setCompanyError("Failed to load company details");
    } finally {
      setCompanyLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== "string") return;

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: formData.name,
          short_name: formData.short_name || null,
          address: formData.address || null,
          vat_number: formData.vat_number || null,
          company_number: formData.company_number || null,
          website: formData.website || null,
          linkedin_url: formData.linkedin_url || null,
          accounts_email: formData.accounts_email || null,
          notes: formData.notes || null,
        })
        .eq("id", id);

      if (error) throw error;

      await fetchCompanyData(id);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update company", err);
      alert("Failed to update company");
    }
  };

  const handleDelete = async () => {
    if (!id || typeof id !== "string") return;
    if (!confirm("Are you sure you want to delete this company? This will also delete all associated opportunities and contacts.")) return;

    try {
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", id);

      if (error) throw error;
      router.push("/companies");
    } catch (err) {
      console.error("Failed to delete company", err);
      alert("Failed to delete company");
    }
  };

  const fetchContactsData = async (companyId: string) => {
    try {
      setContactsLoading(true);
      setContactsError(null);

      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("name");

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error("Failed to load contacts data", err);
      setContactsError("Failed to load contacts");
    } finally {
      setContactsLoading(false);
    }
  };

  const fetchOpportunitiesData = async (companyId: string) => {
    try {
      setOpportunitiesLoading(true);
      setOpportunitiesError(null);

      const { data, error } = await supabase
        .from("opportunities")
        .select("id, name, stage, status, expected_fee_value")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOpportunities(data || []);
    } catch (err) {
      console.error("Failed to load opportunities data", err);
      setOpportunitiesError("Failed to load opportunities");
    } finally {
      setOpportunitiesLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Link href="/companies">
            <Button variant="ghost" size="sm" className="gap-2 self-start">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        {/* Company Details Card */}
        <Card>
          {companyLoading ? (
            <CardContent className="p-8 text-center">
              <div className="text-slate-600">Loading company details...</div>
            </CardContent>
          ) : companyError || !company ? (
            <CardContent className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{companyError || "Company not found"}</AlertDescription>
              </Alert>
            </CardContent>
          ) : (
            <>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <CardTitle className="text-xl sm:text-2xl">{company.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {canEdit && !isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                  )}
                  {canDelete && !isEditing && (
                    <Button variant="outline" size="sm" onClick={handleDelete} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Company Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="short_name">Short Name</Label>
                        <Input
                          id="short_name"
                          value={formData.short_name}
                          onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_number">Company Number</Label>
                        <Input
                          id="company_number"
                          value={formData.company_number}
                          onChange={(e) => setFormData({ ...formData, company_number: e.target.value })}
                          placeholder="e.g. 12345678"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vat_number">VAT Number</Label>
                        <Input
                          id="vat_number"
                          value={formData.vat_number}
                          onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                          placeholder="e.g. GB123456789"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          type="url"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          placeholder="https://example.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
                        <Input
                          id="linkedin_url"
                          type="url"
                          placeholder="https://linkedin.com/company/..."
                          value={formData.linkedin_url}
                          onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="accounts_email">Accounts/Invoicing Email</Label>
                        <Input
                          id="accounts_email"
                          type="email"
                          placeholder="accounts@company.com"
                          value={formData.accounts_email}
                          onChange={(e) => setFormData({ ...formData, accounts_email: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={3}
                        placeholder="Full company address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={4}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button type="submit">Save Changes</Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {company.short_name && (
                        <div>
                          <div className="text-sm font-medium text-slate-500">Short Name</div>
                          <div className="text-slate-900">{company.short_name}</div>
                        </div>
                      )}
                      {company.company_number && (
                        <div>
                          <div className="text-sm font-medium text-slate-500">Company Number</div>
                          <div className="text-slate-900">{company.company_number}</div>
                        </div>
                      )}
                      {company.vat_number && (
                        <div>
                          <div className="text-sm font-medium text-slate-500">VAT Number</div>
                          <div className="text-slate-900">{company.vat_number}</div>
                        </div>
                      )}
                      {company.website && (
                        <div>
                          <div className="text-sm font-medium text-slate-500">Website</div>
                          <a 
                            href={company.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                          >
                            {company.website}
                          </a>
                        </div>
                      )}
                      {company.linkedin_url && (
                        <div>
                          <div className="text-sm font-medium text-slate-500">LinkedIn</div>
                          <a 
                            href={company.linkedin_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                          >
                            <Linkedin className="w-4 h-4" />
                            <span>Company Profile</span>
                          </a>
                        </div>
                      )}
                      {company.accounts_email && (
                        <div>
                          <div className="text-sm font-medium text-slate-500">Accounts Email</div>
                          <a 
                            href={`mailto:${company.accounts_email}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                          >
                            <Mail className="w-4 h-4" />
                            <span>{company.accounts_email}</span>
                          </a>
                        </div>
                      )}
                    </div>
                    {company.address && (
                      <div>
                        <div className="text-sm font-medium text-slate-500 mb-1">Address</div>
                        <div className="text-slate-900 whitespace-pre-wrap">{company.address}</div>
                      </div>
                    )}
                    {company.notes && (
                      <div>
                        <div className="text-sm font-medium text-slate-500 mb-1">Notes</div>
                        <div className="text-slate-900 whitespace-pre-wrap">{company.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>

        {/* Contacts Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {contactsLoading ? (
              <div className="text-center py-6 text-slate-600">Loading contacts...</div>
            ) : contactsError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{contactsError}</AlertDescription>
              </Alert>
            ) : contacts.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm sm:text-base">
                No contacts for this company yet.
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 sm:p-4 border rounded-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h4 className="font-medium text-sm sm:text-base text-slate-900">{contact.name}</h4>
                      {contact.job_title && (
                        <span className="text-xs sm:text-sm text-slate-500">• {contact.job_title}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                          <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <a href={`mailto:${contact.email}`} className="hover:text-blue-600 break-all">
                            {contact.email}
                          </a>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                          <Phone className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                            {contact.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Opportunities Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            {opportunitiesLoading ? (
              <div className="text-center py-6 text-slate-600">Loading opportunities...</div>
            ) : opportunitiesError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{opportunitiesError}</AlertDescription>
              </Alert>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm sm:text-base">
                No opportunities for this company yet.
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-3 sm:p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => router.push(`/opportunities/${opp.id}`)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base text-slate-900 mb-2">{opp.name}</h4>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{opp.stage}</Badge>
                          <Badge variant="outline" className="text-xs">{opp.status}</Badge>
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <div className="text-xs sm:text-sm text-slate-500">Expected Value</div>
                        <div className="font-medium text-sm sm:text-base">{formatCurrency(opp.expected_fee_value)}</div>
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

export default function CompanyDetailPage() {
  return (
    <RequireAuth>
      <CompanyDetailContent />
    </RequireAuth>
  );
}