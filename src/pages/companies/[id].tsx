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
import { ArrowLeft, Mail, Phone, AlertTriangle } from "lucide-react";
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
  
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companyError, setCompanyError] = useState<string | null>(null);
  
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);

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
      
      setCompany(data);
    } catch (err) {
      console.error("Failed to load company data", err);
      setCompanyError("Failed to load company details");
    } finally {
      setCompanyLoading(false);
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <CardTitle className="text-xl sm:text-2xl">{company.name}</CardTitle>
                  <Badge className={getStatusColor(company.status)}>
                    {company.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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