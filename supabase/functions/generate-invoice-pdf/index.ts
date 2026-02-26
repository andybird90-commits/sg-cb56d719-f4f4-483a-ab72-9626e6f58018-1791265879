import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  PDFDocument,
  StandardFonts,
  PageSizes,
} from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type InvoicePdfItem = {
  id: string;
  invoice_month_id: string;
  project_id: string;
  project_name: string | null;
  project_code: string | null;
  client_name: string | null;
  po_number: string | null;
  invoice_value: number | null;
  description: string | null;
  accounts_email: string | null;
  client_address: string | null;
  enquiry_number: string | null;
  project_reference: string | null;
  project_owner_name: string | null;
  payment_terms: number | null;
  updated_at: string | null;
};

type GeneratePdfPayload = {
  invoiceMonthId: string;
  year: number;
  month: number;
  items: InvoicePdfItem[];
  totalValue: number;
  options?: {
    bucket?: string;
    revisionLabel?: string;
    // extra properties from caller are ignored safely
    [key: string]: unknown;
  };
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const {
      invoiceMonthId,
      year,
      month,
      items,
      totalValue,
      options,
    } = (await req.json()) as GeneratePdfPayload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const pdfDoc = await PDFDocument.create();
    const pageSize: [number, number] = [PageSizes.A4[1], PageSizes.A4[0]];
    let page = pdfDoc.addPage(pageSize);
    let { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    const monthLabel = `${year}-${String(month).padStart(2, "0")}`;
    const title = `Invoice Summary - ${monthLabel}`;
    page.drawText(title, { x: 50, y, size: 16, font: fontBold });
    y -= 20;

    // Explicit layout marker so we can confirm the new code is live
    page.drawText("Layout v2 – detailed invoice export", {
      x: 50,
      y,
      size: 10,
      font,
    });
    y -= 20;

    page.drawText(`Invoice Month ID: ${invoiceMonthId}`, {
      x: 50,
      y,
      size: 10,
      font,
    });
    y -= 20;

    const header = "Project                             Client                             Value";
    page.drawText(header, { x: 50, y, size: 10, font: fontBold });
    y -= 15;

    const ensureSpaceForLines = (lineCount: number): void => {
      const requiredHeight = lineCount * 12 + 40;
      if (y - requiredHeight < 40) {
        page.drawText("Continued on next page...", {
          x: 50,
          y: 40,
          size: 9,
          font,
        });
        page = pdfDoc.addPage(pageSize);
        ({ width, height } = page.getSize());
        y = height - 50;
        page.drawText(header, { x: 50, y, size: 10, font: fontBold });
        y -= 15;
      }
    };

    for (const item of items) {
      const detailLines: string[] = [];

      if (item.po_number) {
        detailLines.push(`PO Number: ${item.po_number}`);
      }

      if (item.enquiry_number || item.project_reference) {
        const parts: string[] = [];
        if (item.enquiry_number) {
          parts.push(`Enquiry: ${item.enquiry_number}`);
        }
        if (item.project_reference) {
          parts.push(`Project Ref: ${item.project_reference}`);
        }
        detailLines.push(parts.join(" | "));
      }

      if (item.project_owner_name) {
        detailLines.push(`Project Owner: ${item.project_owner_name}`);
      }

      if (typeof item.payment_terms === "number") {
        detailLines.push(`Payment Terms: ${item.payment_terms} days`);
      }

      if (item.updated_at) {
        const dateOnly = item.updated_at.split("T")[0];
        detailLines.push(`Last Updated: ${dateOnly}`);
      }

      if (item.description) {
        detailLines.push(`Description: ${item.description}`);
      }

      if (item.accounts_email) {
        detailLines.push(`Email Contact: ${item.accounts_email}`);
      }

      if (item.client_address) {
        detailLines.push(`Address: ${item.client_address}`);
      }

      // We need space for:
      // - 1 main line (project/client/value)
      // - all detail lines
      // - a small gap after the block
      ensureSpaceForLines(1 + detailLines.length + 1);

      const projectLabel =
        `${item.project_code ?? ""} ${item.project_name ?? ""}`.trim() ||
        "N/A";
      const clientLabel = item.client_name ?? "N/A";
      const valueLabel =
        item.invoice_value !== null && item.invoice_value !== undefined
          ? item.invoice_value.toFixed(2)
          : "0.00";

      // Main row
      page.drawText(projectLabel, { x: 50, y, size: 10, font });
      page.drawText(clientLabel, { x: 220, y, size: 10, font });
      page.drawText(valueLabel, { x: 400, y, size: 10, font });
      y -= 14;

      // Detail lines
      for (const line of detailLines) {
        page.drawText(line, { x: 60, y, size: 9, font });
        y -= 12;
      }

      // Small gap between items
      y -= 6;
    }

    // Ensure there is space for the total at the bottom
    if (y < 80) {
      page.drawText("Continued on next page...", {
        x: 50,
        y: 40,
        size: 9,
        font,
      });
      page = pdfDoc.addPage(pageSize);
      ({ width, height } = page.getSize());
      y = height - 80;
    }

    const totalText = `Total Invoiced Value: ${totalValue.toFixed(2)}`;
    page.drawText(totalText, { x: 50, y, size: 12, font: fontBold });

    // Add page numbers to all pages before saving
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    pages.forEach((p, index) => {
      const { width: pageWidth } = p.getSize();
      const pageNumberText = `Page ${index + 1} of ${totalPages}`;
      const fontSize = 9;
      const textWidth = font.widthOfTextAtSize(pageNumberText, fontSize);

      p.drawText(pageNumberText, {
        x: (pageWidth - textWidth) / 2,
        y: 30,
        size: fontSize,
        font,
      });
    });

    const pdfBytes = await pdfDoc.save();

    const bucket = (options?.bucket as string | undefined) || "invoices";
    const baseName = `invoice-${monthLabel}-${invoiceMonthId}`;
    const fileName =
      typeof options?.revisionLabel === "string" &&
      options.revisionLabel.trim().length > 0
        ? `${baseName}-${options.revisionLabel}.pdf`
        : `${baseName}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError || !uploadData) {
      console.error("PDF upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload invoice PDF" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);

    return new Response(JSON.stringify({ pdfUrl: publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-invoice-pdf error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate invoice PDF" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});