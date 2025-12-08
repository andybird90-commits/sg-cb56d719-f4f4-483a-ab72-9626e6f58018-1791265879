import { RequireAuth } from "@/components/RequireAuth";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, User, Mail, Phone, ArrowLeft, LogOut } from "lucide-react";

interface Contact {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function ContactsContent() {
  const router = useRouter();
  const { session } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("name");

    if (!error && data) {
      setContacts(data);
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
        contact.job_title?.toLowerCase().includes(searchLower)
      );
    });

    setFilteredContacts(filtered);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/signin");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-slate-900">Conexa DT</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
            <p className="text-slate-600 mt-1">All business contacts</p>
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
                    ? "Connect your Supabase database to get started"
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
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ContactsPage() {
  return (
    <RequireAuth>
      <ContactsContent />
    </RequireAuth>
  );
}