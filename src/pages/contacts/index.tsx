import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Contact, Company } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, User, Mail, Phone, Building2 } from "lucide-react";
import Link from "next/link";

interface ContactWithCompany extends Contact {
  company?: Company;
}

export default function ContactsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data: contactsData, error } = await supabase
      .from("contacts")
      .select("*, companies(*)")
      .order("name");

    if (!error && contactsData) {
      const formatted = contactsData.map((contact: any) => ({
        ...contact,
        company: contact.companies,
        companies: undefined,
      }));
      setContacts(formatted);
    }
    setLoading(false);
  };

  const filterContacts = () => {
    if (!searchTerm) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter((contact) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        contact.name.toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        contact.phone?.toLowerCase().includes(searchLower) ||
        contact.job_title?.toLowerCase().includes(searchLower) ||
        contact.company?.name.toLowerCase().includes(searchLower)
      );
    });

    setFilteredContacts(filtered);
  };

  if (authLoading || loading) {
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
          <p className="text-slate-600 mt-1">All business contacts across companies</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="w-12 h-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">No contacts found</h3>
              <p className="text-slate-600 text-sm">
                {contacts.length === 0
                  ? "Add contacts through company detail pages"
                  : "Try adjusting your search"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredContacts.map((contact) => (
              <Card key={contact.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-5 h-5 text-slate-400" />
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {contact.name}
                          </h3>
                          {contact.job_title && (
                            <p className="text-sm text-slate-600">{contact.job_title}</p>
                          )}
                        </div>
                      </div>

                      <div className="ml-8 space-y-2">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="w-4 h-4" />
                            <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-4 h-4" />
                            <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                              {contact.phone}
                            </a>
                          </div>
                        )}
                        {contact.company && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <Link
                              href={`/companies/${contact.company_id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {contact.company.name}
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}