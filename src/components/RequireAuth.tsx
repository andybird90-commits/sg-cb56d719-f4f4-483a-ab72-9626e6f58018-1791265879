import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/auth/signin");
    }
  }, [loading, session, router]);

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

  if (!session) {
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