import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts } from "pdf-lib";

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
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { invoiceMonthId, year, month, items, totalValue } =
      req.body as GeneratePdfPayload;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    const title = `Invoice Summary - ${year}-${String(month).padStart(2, "0")}`;
    page.drawText(title, { x: 50, y, size: 16, font: fontBold });
    y -= 30;

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
        page = pdfDoc.addPage();
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

      if (item.payment_terms !== null && item.payment_terms !== undefined) {
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

      ensureSpaceForLines(1 + detailLines.length + 1);

      const projectLabel =
        `${item.project_code ?? ""} ${item.project_name ?? ""}`.trim() || "N/A";
      const clientLabel = item.client_name ?? "N/A";
      const valueLabel =
        item.invoice_value !== null && item.invoice_value !== undefined
          ? item.invoice_value.toFixed(2)
          : "0.00";

      page.drawText(projectLabel, { x: 50, y, size: 10, font });
      page.drawText(clientLabel, { x: 220, y, size: 10, font });
      page.drawText(valueLabel, { x: 400, y, size: 10, font });
      y -= 14;

      for (const line of detailLines) {
        page.drawText(line, { x: 60, y, size: 9, font });
        y -= 12;
      }

      y -= 6;
    }

    if (y < 80) {
      page.drawText("Continued on next page...", {
        x: 50,
        y: 40,
        size: 9,
        font,
      });
      page = pdfDoc.addPage();
      y = height - 80;
    }

    const totalText = `Total Invoiced Value: ${totalValue.toFixed(2)}`;
    page.drawText(totalText, { x: 50, y, size: 12, font: fontBold });

    const pdfBytes = await pdfDoc.save();
    const fileName = `invoice-${year}-${String(month).padStart(
      2,
      "0"
    )}-${invoiceMonthId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    res
      .status(500)
      .json({ error: "Failed to generate invoice PDF" });
  }
}