import { useEffect } from "react";
import { useRouter } from "next/router";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Always redirect to signin page as the landing page
    router.replace("/auth/signin");
  }, [router]);

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