import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";

export default function ProcurementPage() {
  return (
    <RequireAuth>
      <Layout>
        <div className="space-y-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Procurement
            </h1>
            <p className="text-muted-foreground text-lg">
              This area is coming soon. We&apos;re preparing procurement tooling for your projects.
            </p>
          </div>
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            <p>
              The Procurement module will centralise supplier packages, tender returns, and award decisions
              alongside your existing Conexa DT project data.
            </p>
            <p className="mt-2">
              If you have specific procurement workflows you&apos;d like to support here, let us know and we can
              prioritise them.
            </p>
          </div>
        </div>
      </Layout>
    </RequireAuth>
  );
}