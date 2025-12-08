import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  profileError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  profileError: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      console.log("🔍 Fetching profile for user:", userId);
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      
      if (error) {
        console.error("❌ Error fetching profile:", error);
        setProfileError(`Database error: ${error.message}`);
        return;
      }
      
      if (!data) {
        console.warn("⚠️ No profile found for user:", userId);
        setProfileError("Profile not found in database. Please contact support.");
        return;
      }
      
      console.log("✅ Profile loaded successfully:", data);
      setProfile(data);
      setProfileError(null);
    } catch (error) {
      console.error("❌ Unexpected error fetching profile:", error);
      setProfileError("Failed to load profile. Please refresh the page.");
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🔐 Initial session check:", session ? "User logged in" : "No session");
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    }).catch((error) => {
      console.error("❌ Auth initialization error:", error);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("🔄 Auth state changed:", _event);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setProfileError(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setProfileError(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile, profileError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);