import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Activity } from "lucide-react";

function DesignRLiteComingSoon() {
  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <span>DesignR™ Lite</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Lightweight front-end to DesignR™ for rapid optioneering and
              design inputs into bids and early-stage projects.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Coming soon</p>
          <p>
            DesignR™ Lite is not yet available in this environment. When enabled,
            it will connect to your DesignR™ models and datasets so that bid and
            project teams can pull structured design insights without leaving
            OpportunityFlow.
          </p>
        </div>
      </div>
    </Layout>
  );
}

export default function DesignRLitePage() {
  return (
    <RequireAuth>
      <DesignRLiteComingSoon />
    </RequireAuth>
  );
}