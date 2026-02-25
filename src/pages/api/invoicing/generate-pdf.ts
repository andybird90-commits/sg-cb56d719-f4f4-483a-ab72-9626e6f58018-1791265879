import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PDFFont } from "pdf-lib";

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

const formatCurrency = (value: number): string =>
  value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const wrapText = (
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] => {
  if (!text) {
    return [];
  }

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
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
    const rawBody = req.body as Partial<GeneratePdfPayload> | undefined;

    console.log("Generate invoice PDF payload debug:", {
      type: typeof rawBody,
      hasBody: !!rawBody,
      keys: rawBody && typeof rawBody === "object" ? Object.keys(rawBody) : null,
    });

    const invoiceMonthId =
      typeof rawBody?.invoiceMonthId === "string"
        ? rawBody.invoiceMonthId
        : "Unknown";

    const year =
      typeof rawBody?.year === "number"
        ? rawBody.year
        : Number(rawBody?.year ?? 0) || 0;

    const month =
      typeof rawBody?.month === "number"
        ? rawBody.month
        : Number(rawBody?.month ?? 0) || 0;

    const items: InvoicePdfItem[] = Array.isArray(rawBody?.items)
      ? (rawBody?.items as InvoicePdfItem[])
      : [];

    const totalValue =
      typeof rawBody?.totalValue === "number"
        ? rawBody.totalValue
        : Number(rawBody?.totalValue ?? 0) || 0;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const marginLeft = 50;
    const marginRight = 50;
    const marginTop = 50;
    const marginBottom = 60;

    const contentWidth = width - marginLeft - marginRight;

    let y = height - marginTop;

    const headerTextSize = 16;
    const bodyTextSize = 10;
    const detailTextSize = 9;
    const lineGap = 4;

    const drawHeaderRow = (): void => {
      const projectColX = marginLeft;
      const clientColX = marginLeft + contentWidth * 0.45;
      const valueColRightX = width - marginRight;

      const headerProject = "Project";
      const headerClient = "Client";
      const headerValue = "Value";

      page.drawText(headerProject, {
        x: projectColX,
        y,
        size: bodyTextSize,
        font: fontBold,
      });

      page.drawText(headerClient, {
        x: clientColX,
        y,
        size: bodyTextSize,
        font: fontBold,
      });

      const valueHeaderWidth = fontBold.widthOfTextAtSize(
        headerValue,
        bodyTextSize
      );
      page.drawText(headerValue, {
        x: valueColRightX - valueHeaderWidth,
        y,
        size: bodyTextSize,
        font: fontBold,
      });

      y -= bodyTextSize + lineGap;
    };

    const ensureSpace = (linesNeeded: number): void => {
      const lineHeight = detailTextSize + 2;
      const requiredHeight = linesNeeded * lineHeight + 2 * lineGap;

      if (y - requiredHeight < marginBottom) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        y = height - marginTop;
        drawHeaderRow();
      }
    };

    const projectColX = marginLeft;
    const clientColX = marginLeft + contentWidth * 0.45;
    const valueColRightX = width - marginRight;

    const title = `Invoice Summary - ${year}-${String(month).padStart(2, "0")}`;
    page.drawText(title, {
      x: marginLeft,
      y,
      size: headerTextSize,
      font: fontBold,
    });
    y -= headerTextSize + 10;

    page.drawText(`Invoice Month ID: ${invoiceMonthId}`, {
      x: marginLeft,
      y,
      size: 10,
      font,
    });
    y -= 22;

    drawHeaderRow();

    const detailMaxWidth = contentWidth - 20;
    const detailIndentX = marginLeft + 10;

    for (const item of items) {
      const detailLines: string[] = [];

      const projectRefParts: string[] = [];
      if (item.project_reference) {
        projectRefParts.push(`Project Ref: ${item.project_reference}`);
      }
      if (item.enquiry_number) {
        projectRefParts.push(`Enquiry: ${item.enquiry_number}`);
      }
      if (projectRefParts.length > 0) {
        detailLines.push(projectRefParts.join(" | "));
      }

      if (item.po_number) {
        detailLines.push(`PO Number: ${item.po_number}`);
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

      const wrappedDetailLines: string[] = [];

      for (const text of detailLines) {
        const wrapped = wrapText(text, detailMaxWidth, font, detailTextSize);
        if (wrapped.length === 0) {
          continue;
        }
        wrappedDetailLines.push(...wrapped);
      }

      const linesForItem = 1 + wrappedDetailLines.length + 1;
      ensureSpace(linesForItem);

      const projectLabel =
        `${item.project_code ?? ""} ${item.project_name ?? ""}`.trim() ||
        "N/A";
      const clientLabel = item.client_name ?? "N/A";
      const valueNumber =
        item.invoice_value !== null && item.invoice_value !== undefined
          ? item.invoice_value
          : 0;
      const valueLabel = formatCurrency(valueNumber);

      page.drawText(projectLabel, {
        x: projectColX,
        y,
        size: bodyTextSize,
        font,
      });

      page.drawText(clientLabel, {
        x: clientColX,
        y,
        size: bodyTextSize,
        font,
      });

      const valueWidth = font.widthOfTextAtSize(valueLabel, bodyTextSize);
      page.drawText(valueLabel, {
        x: valueColRightX - valueWidth,
        y,
        size: bodyTextSize,
        font,
      });

      y -= bodyTextSize + lineGap;

      for (const line of wrappedDetailLines) {
        page.drawText(line, {
          x: detailIndentX,
          y,
          size: detailTextSize,
          font,
        });
        y -= detailTextSize + 2;
      }

      y -= lineGap + 2;
    }

    if (y < marginBottom + 20) {
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      y = height - marginTop - 20;
    }

    const totalText = `Total Invoiced Value: ${formatCurrency(totalValue)}`;
    page.drawText(totalText, {
      x: marginLeft,
      y,
      size: 12,
      font: fontBold,
    });

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

    const message =
      error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const responseBody: { error: string; details: string; stack?: string } = {
      error: "Failed to generate invoice PDF",
      details: message,
    };

    if (process.env.NODE_ENV !== "production" && stack) {
      responseBody.stack = stack;
    }

    res.status(500).json(responseBody);
  }
}