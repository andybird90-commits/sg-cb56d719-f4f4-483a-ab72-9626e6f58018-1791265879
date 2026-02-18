import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Mail, Phone, Building2, User, Briefcase, FileText, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ContactCalendar } from "@/components/ContactCalendar";
import { ContactTimeline } from "@/components/ContactTimeline";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  notes: string | null;
  company_id: string;
  added_by_user_id: string | null;
  companies?: {
    id: string;
    name: string;
  };
  added_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

function ContactDetailContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { id, returnTo } = router.query;
  
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchContact(id);
    }
  }, [id]);

  const fetchContact = async (contactId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("contacts")
        .select(`
          *,
          companies (
            id,
            name
          ),
          added_by_profile:profiles (
            full_name,
            email
          )
        `)
        .eq("id", contactId)
        .single();

      if (error) throw error;
      setContact(data as any);
    } catch (err) {
      console.error("Failed to load contact", err);
      setError("Failed to load contact details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading contact...</div>
        </div>
      </Layout>
    );
  }

  if (error || !contact) {
    return (
      <Layout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || "Contact not found"}</AlertDescription>
          </Alert>
          <Link href="/contacts">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Contacts
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {returnTo === '/calendar' ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/calendar">Calendar</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/contacts">Contacts</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage>{contact?.name || 'Contact'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Link href="/contacts">
                <Button variant="ghost" size="sm" className="gap-2 self-start">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{contact.name}</h1>
                <div className="flex items-center gap-2 text-slate-600 mt-1">
                  <Building2 className="w-4 h-4" />
                  <Link href={`/companies/${contact.company_id}`} className="hover:text-blue-600 hover:underline">
                    {contact.companies?.name}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contact.job_title && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Job Title</div>
                      <div className="text-sm font-medium">{contact.job_title}</div>
                    </div>
                  </div>
                )}

                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Email</div>
                      <a href={`mailto:${contact.email}`} className="text-sm font-medium text-blue-600 hover:underline break-all">
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}

                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Phone</div>
                      <a href={`tel:${contact.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                )}

                {contact.notes && (
                  <div className="pt-4 border-t">
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Notes</div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">{contact.notes}</div>
                      </div>
                    </div>
                  </div>
                )}

                {contact.added_by_user_id && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-xs text-slate-500">Added by</div>
                        <div className="text-sm text-slate-700">
                          {contact.added_by_profile?.full_name || contact.added_by_profile?.email || "Unknown"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Calendar and Timeline Section */}
          <div className="lg:col-span-2 space-y-6">
            <ContactCalendar 
              contactId={contact.id} 
              contactName={contact.name} 
              isDetailView={true} 
            />
            
            <ContactTimeline 
              contactId={contact.id}
              contactName={contact.name}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function ContactDetailPage() {
  return (
    <RequireAuth>
      <ContactDetailContent />
    </RequireAuth>
  );
}