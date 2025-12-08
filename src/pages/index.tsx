import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";

export default function RootRedirect() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (session) {
        router.replace("/dashboard");
      } else {
        router.replace("/auth/signin");
      }
    }
  }, [loading, session, router]);

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