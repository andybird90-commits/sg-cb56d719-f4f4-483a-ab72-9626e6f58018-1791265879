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
import { ArrowLeft, Mail, Phone } from "lucide-react";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
  short_name: string | null;
  sector: string | null;
  status: string;
  notes: string | null;
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchCompanyData(id);
    }
  }, [id]);

  const fetchCompanyData = async (companyId: string) => {
    setLoading(true);
    
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError || !companyData) {
      setError("Company not found");
      setLoading(false);
      return;
    }

    const { data: contactsData } = await supabase
      .from("contacts")
      .select("*")
      .eq("company_id", companyId)
      .order("name");

    const { data: opportunitiesData } = await supabase
      .from("opportunities")
      .select("id, name, stage, status, expected_fee_value")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    setCompany(companyData);
    setContacts(contactsData || []);
    setOpportunities(opportunitiesData || []);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "prospect":
        return "bg-blue-100 text-blue-800";
      case "inactive":
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
      minimumFractionDigits: 0,
    }).format(value);
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

  if (error || !company) {
    return (
      <Layout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Link href="/companies">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Companies
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/companies">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">{company.name}</CardTitle>
              <Badge className={getStatusColor(company.status)}>
                {company.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {company.short_name && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">Short Name</div>
                    <div className="text-slate-900">{company.short_name}</div>
                  </div>
                )}
                {company.sector && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">Sector</div>
                    <div className="text-slate-900">{company.sector}</div>
                  </div>
                )}
              </div>
              {company.notes && (
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Notes</div>
                  <div className="text-slate-900 whitespace-pre-wrap">{company.notes}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No contacts for this company yet.
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-900">{contact.name}</h4>
                      {contact.job_title && (
                        <span className="text-sm text-slate-500">• {contact.job_title}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-3 h-3" />
                          <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                            {contact.email}
                          </a>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="w-3 h-3" />
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

        <Card>
          <CardHeader>
            <CardTitle>Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            {opportunities.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No opportunities for this company yet.
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-4 border rounded-lg cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/opportunities/${opp.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{opp.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{opp.stage}</Badge>
                          <Badge variant="outline">{opp.status}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Expected Value</div>
                        <div className="font-medium">{formatCurrency(opp.expected_fee_value)}</div>
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