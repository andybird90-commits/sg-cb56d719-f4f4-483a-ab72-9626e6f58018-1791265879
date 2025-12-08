import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

export default function RootRedirect() {
  const { user, loading, authError } = useAuth();
  const router = useRouter();
  const [redirectTimeout, setRedirectTimeout] = useState(false);

  useEffect(() => {
    // Set a backup timeout in case routing fails
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("⚠️ Redirect timeout - forcing navigation");
        setRedirectTimeout(true);
        router.replace("/auth/signin");
      }
    }, 15000); // 15 second backup timeout

    if (!loading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/auth/signin");
      }
    }

    return () => clearTimeout(timeout);
  }, [loading, user, router]);

  // Show error state if authentication failed
  if (authError) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        flexDirection: "column",
        alignItems: "center", 
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        padding: "20px"
      }}>
        <div style={{ 
          maxWidth: "400px", 
          textAlign: "center",
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <div style={{ color: "#dc2626", marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
            Authentication Error
          </div>
          <div style={{ color: "#64748b", marginBottom: "20px", fontSize: "14px" }}>
            {authError}
          </div>
          <button
            onClick={() => router.push("/auth/signin")}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Show timeout message if loading takes too long
  if (redirectTimeout) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        flexDirection: "column",
        alignItems: "center", 
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        padding: "20px"
      }}>
        <div style={{ 
          maxWidth: "400px", 
          textAlign: "center",
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <div style={{ color: "#f59e0b", marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
            Loading Timeout
          </div>
          <div style={{ color: "#64748b", marginBottom: "20px", fontSize: "14px" }}>
            The page is taking longer than expected. Redirecting to sign in...
          </div>
        </div>
      </div>
    );
  }

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