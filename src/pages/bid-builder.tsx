import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { FileText } from "lucide-react";

function BidBuilderComingSoon() {
  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <span>Bid Builder</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Structured bid planning and drafting workspace. This will help you
              turn opportunity strategies into concrete bid plans, templates, and
              draft content.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Coming soon</p>
          <p>
            Bid Builder is not yet available in this environment. Once enabled,
            it will integrate tightly with Win Themes and your opportunity data
            to provide guided bid structures, content blocks, and workflow.
          </p>
        </div>
      </div>
    </Layout>
  );
}

export default function BidBuilderPage() {
  return (
    <RequireAuth>
      <BidBuilderComingSoon />
    </RequireAuth>
  );
}