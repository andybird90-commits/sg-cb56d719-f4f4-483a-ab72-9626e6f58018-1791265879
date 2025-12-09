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
        console.error("❌ Failed to load user profile:", error);
        setProfileError(`Database error: ${error.message}`);
        return;
      }
      
      if (!data) {
        console.error("⚠️ Failed to load user profile: Profile not found for user:", userId);
        setProfileError("Profile not found in database. Some features may be limited.");
        return;
      }
      
      console.log("✅ Profile loaded successfully:", data);
      setProfile(data);
      setProfileError(null);
    } catch (error) {
      console.error("❌ Failed to load user profile:", error);
      setProfileError("Failed to load profile. Some features may be limited.");
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("❌ Session fetch error:", error);
        setLoading(false);
        return;
      }
      
      console.log("🔐 Initial session check:", session ? "User logged in" : "No session");
      
      // Immediately set user and mark loading as complete
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Load profile in background (non-blocking)
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    }).catch((error) => {
      console.error("❌ Auth initialization error:", error);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔄 Auth state changed:", event);
        
        // Immediately update user state (non-blocking)
        setUser(session?.user ?? null);
        
        // Handle SIGNED_IN event
        if (event === "SIGNED_IN" && session?.user) {
          console.log("✅ User signed in, loading profile in background");
          // Load profile in background (non-blocking)
          fetchProfile(session.user.id);
        } else if (!session?.user) {
          // Clear profile when user signs out
          setProfile(null);
          setProfileError(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
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