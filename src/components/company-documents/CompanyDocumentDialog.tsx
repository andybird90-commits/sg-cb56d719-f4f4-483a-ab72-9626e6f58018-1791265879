import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export type CompanyDocumentUpsertValues = {
  title: string;
  description: string;
  expiry_date: string;
};

export type CompanyDocumentDialogMode = "create" | "edit";

export type CompanyDocumentDialogInitial = CompanyDocumentUpsertValues & {
  filename?: string | null;
};

export function CompanyDocumentDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CompanyDocumentDialogMode;
  submitting: boolean;
  initial?: CompanyDocumentDialogInitial;
  onSubmit: (values: CompanyDocumentUpsertValues, file?: File) => Promise<void>;
}) {
  const { open, onOpenChange, mode, submitting, initial, onSubmit } = props;

  const defaultValues = useMemo<CompanyDocumentUpsertValues>(() => {
    return {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      expiry_date: initial?.expiry_date ?? "",
    };
  }, [initial]);

  const [values, setValues] = useState<CompanyDocumentUpsertValues>(defaultValues);
  const [file, setFile] = useState<File | undefined>(undefined);

  useEffect(() => {
    setValues(defaultValues);
    setFile(undefined);
  }, [defaultValues, open]);

  const title = mode === "create" ? "Upload Company Document" : "Edit Company Document";
  const description =
    mode === "create"
      ? "Add a new official document to the company registry."
      : "Update expiry details and optionally replace the attached file.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(values, file);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company-doc-title">
                Document Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company-doc-title"
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
                placeholder="e.g., Public Liability Insurance"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-doc-description">Description & Purpose</Label>
              <Textarea
                id="company-doc-description"
                value={values.description}
                onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                placeholder="Briefly describe what this document is for..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-doc-expiry">
                Expiry Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company-doc-expiry"
                type="date"
                value={values.expiry_date}
                onChange={(e) => setValues((v) => ({ ...v, expiry_date: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-doc-file">
                {mode === "create" ? "File Attachment" : "Replace File (optional)"}
              </Label>

              {mode === "edit" && initial?.filename ? (
                <p className="text-xs text-muted-foreground">
                  Current file: <span className="font-medium">{initial.filename}</span>
                </p>
              ) : null}

              <Input
                id="company-doc-file"
                type="file"
                onChange={(e) => {
                  const next = e.target.files?.[0];
                  setFile(next);
                }}
                className="cursor-pointer"
              />

              {file ? (
                <p className="text-xs text-muted-foreground">
                  New file selected: <span className="font-medium">{file.name}</span>
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "create" ? "Save Document" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}