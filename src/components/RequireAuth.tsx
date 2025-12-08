import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/signin");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        backgroundColor: "#f8fafc"
      }}>
        <div style={{ color: "#64748b" }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        backgroundColor: "#f8fafc"
      }}>
        <div style={{ color: "#64748b" }}>Redirecting...</div>
      </div>
    );
  }

  return <>{children}</>;
}