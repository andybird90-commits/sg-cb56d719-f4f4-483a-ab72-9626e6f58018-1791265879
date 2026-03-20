import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Calendar as CalendarIcon, 
  User, 
  Clock,
  Edit,
  Trash2,
  Send
} from "lucide-react";

interface TimelineEntry {
  id: string;
  contact_id: string;
  post_type: "event" | "post" | "note";
  content: string;
  event_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
  contact_events?: {
    title: string;
    event_type: "visit" | "function";
    event_date: string;
  } | null;
}

interface ContactTimelineProps {
  contactId: string;
  contactName: string;
}

export function ContactTimeline({ contactId, contactName }: ContactTimelineProps) {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    fetchTimeline();

    // Listen for timeline refresh events from calendar
    const handleRefresh = () => {
      console.log("Timeline refresh event received");
      fetchTimeline();
    };

    window.addEventListener("timeline-refresh", handleRefresh);
    return () => window.removeEventListener("timeline-refresh", handleRefresh);
  }, [contactId]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      console.log("=== FETCHING TIMELINE ===");
      console.log("Contact ID:", contactId);

      const { data, error } = await (supabase
        .from("contact_timeline" as any)
        .select(`
          *,
          profiles!contact_timeline_created_by_user_id_fkey (
            full_name,
            email
          ),
          contact_events (
            title,
            event_type,
            event_date
          )
        `)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })) as any;

      if (error) {
        console.error("❌ Timeline fetch error:", error);
        throw error;
      }

      console.log("✅ Timeline data fetched:", data);
      setEntries((data as TimelineEntry[]) || []);
    } catch (err) {
      console.error("Failed to load timeline", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !user) return;

    try {
      setPosting(true);
      const { error } = await (supabase.from("contact_timeline" as any).insert({
        contact_id: contactId,
        post_type: "post",
        content: newPost.trim(),
        created_by_user_id: user.id,
      })) as any;

      if (error) throw error;

      setNewPost("");
      await fetchTimeline();
    } catch (err) {
      console.error("Failed to create post", err);
      alert("Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  const handleEdit = async (entry: TimelineEntry) => {
    if (!editContent.trim()) return;

    try {
      const { error } = await (supabase
        .from("contact_timeline" as any)
        .update({
          content: editContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id)) as any;

      if (error) throw error;

      setEditingEntry(null);
      setEditContent("");
      await fetchTimeline();
    } catch (err) {
      console.error("Failed to update post", err);
      alert("Failed to update post");
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Delete this post?")) return;

    try {
      const { error } = await (supabase
        .from("contact_timeline" as any)
        .delete()
        .eq("id", entryId)) as any;

      if (error) throw error;
      await fetchTimeline();
    } catch (err) {
      console.error("Failed to delete post", err);
      alert("Failed to delete post");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case "event":
        return <CalendarIcon className="w-4 h-4" />;
      case "post":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getPostTypeColor = (type: string) => {
    switch (type) {
      case "event":
        return "bg-blue-100 text-blue-700";
      case "post":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* New Post Form */}
          <form onSubmit={handlePostSubmit} className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 space-y-2">
                <Textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={`Add an update about ${contactName}...`}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newPost.trim() || posting}
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {posting ? "Posting..." : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          </form>

          {/* Timeline Entries */}
          {loading ? (
            <div className="text-center py-8 text-slate-600">Loading timeline...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No activity yet. Add a post or create an event to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => {
                const isEditing = editingEntry?.id === entry.id;
                const canEdit = user?.id === entry.created_by_user_id && entry.post_type === "post";
                const authorName = entry.profiles?.full_name || entry.profiles?.email || "Unknown User";

                return (
                  <div key={entry.id} className="flex items-start gap-3 pb-4 border-b last:border-b-0">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-slate-600" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-900">
                            {authorName}
                          </span>
                          <Badge variant="outline" className={`text-xs gap-1 ${getPostTypeColor(entry.post_type)}`}>
                            {getPostTypeIcon(entry.post_type)}
                            {entry.post_type}
                          </Badge>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(entry.created_at)}
                          </span>
                        </div>

                        {/* Edit/Delete buttons */}
                        {canEdit && !isEditing && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingEntry(entry);
                                setEditContent(entry.content);
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(entry.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Event badge if linked to calendar event */}
                      {entry.contact_events && (
                        <div className="mb-2 flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`${
                              entry.contact_events.event_type === "visit" ? "bg-blue-500" : "bg-purple-500"
                            } text-white text-xs`}
                          >
                            {entry.contact_events.event_type === "visit" ? "Visit" : "Function"}: {entry.contact_events.title}
                            {" • "}
                            {new Date(entry.contact_events.event_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </Badge>
                          {entry.event_id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent("contact-event-edit", {
                                    detail: { eventId: entry.event_id },
                                  }),
                                );
                              }}
                            >
                              Edit event
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Content */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            className="resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEdit(entry)}
                              disabled={!editContent.trim()}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingEntry(null);
                                setEditContent("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.content}</p>
                      )}

                      {/* Updated indicator */}
                      {entry.updated_at !== entry.created_at && !isEditing && (
                        <span className="text-xs text-slate-400 italic mt-1 block">
                          (edited)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}