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

    const invoiceMonthId =
      typeof rawBody?.invoiceMonthId === "string"
        ? rawBody.invoiceMonthId
        : "Unknown";

    const yearRaw = rawBody?.year as number | string | undefined;
    const monthRaw = rawBody?.month as number | string | undefined;
    const totalValueRaw = rawBody?.totalValue as number | string | undefined;

    const year =
      typeof yearRaw === "number"
        ? yearRaw
        : Number(yearRaw ?? 0) || 0;

    const month =
      typeof monthRaw === "number"
        ? monthRaw
        : Number(monthRaw ?? 0) || 0;

    const items = Array.isArray(rawBody?.items)
      ? (rawBody.items as InvoicePdfItem[])
      : [];

    const totalValue =
      typeof totalValueRaw === "number"
        ? totalValueRaw
        : Number(totalValueRaw ?? 0) || 0;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const topMargin = 50;
    const bottomMargin = 60;
    const leftMargin = 50;
    const rightMargin = width - 50;
    const contentWidth = rightMargin - leftMargin;

    let y = height - topMargin;

    const projectColX = leftMargin;
    const clientColX = leftMargin + contentWidth * 0.45;
    const valueColRightX = rightMargin;

    const headerTextSize = 16;
    const bodyTextSize = 10;
    const detailTextSize = 9;
    const lineGap = 4;

    const title = `Invoice Summary - ${year}-${String(month).padStart(
      2,
      "0"
    )}`;
    page.drawText(title, {
      x: leftMargin,
      y,
      size: headerTextSize,
      font: fontBold,
    });
    y -= headerTextSize + 10;

    page.drawText(`Invoice Month ID: ${invoiceMonthId}`, {
      x: leftMargin,
      y,
      size: 10,
      font,
    });
    y -= 22;

    const drawHeaderRow = (): void => {
      const header = ["Project", "Client", "Value"];
      page.drawText(header[0], {
        x: projectColX,
        y,
        size: bodyTextSize,
        font: fontBold,
      });
      page.drawText(header[1], {
        x: clientColX,
        y,
        size: bodyTextSize,
        font: fontBold,
      });

      const valueHeaderWidth = fontBold.widthOfTextAtSize(
        header[2],
        bodyTextSize
      );
      page.drawText(header[2], {
        x: valueColRightX - valueHeaderWidth,
        y,
        size: bodyTextSize,
        font: fontBold,
      });

      y -= bodyTextSize + lineGap;
    };

    drawHeaderRow();

    const ensureSpaceForLines = (lineCount: number): void => {
      const requiredHeight = lineCount * (detailTextSize + 2) + 2 * lineGap;
      if (y - requiredHeight < bottomMargin) {
        page.drawText("Continued on next page...", {
          x: leftMargin,
          y: bottomMargin - 15,
          size: 8,
          font,
        });
        page = pdfDoc.addPage();
        y = height - topMargin;
        drawHeaderRow();
      }
    };

    for (const item of items) {
      const detailLineTexts: string[] = [];

      const projectRefParts: string[] = [];
      if (item.project_reference) {
        projectRefParts.push(`Project Ref: ${item.project_reference}`);
      }
      if (item.enquiry_number) {
        projectRefParts.push(`Enquiry: ${item.enquiry_number}`);
      }
      if (projectRefParts.length > 0) {
        detailLineTexts.push(projectRefParts.join(" | "));
      }

      if (item.po_number) {
        detailLineTexts.push(`PO Number: ${item.po_number}`);
      }

      if (item.project_owner_name) {
        detailLineTexts.push(`Project Owner: ${item.project_owner_name}`);
      }

      if (item.payment_terms !== null && item.payment_terms !== undefined) {
        detailLineTexts.push(`Payment Terms: ${item.payment_terms} days`);
      }

      if (item.updated_at) {
        const dateOnly = item.updated_at.split("T")[0];
        detailLineTexts.push(`Last Updated: ${dateOnly}`);
      }

      if (item.description) {
        detailLineTexts.push(`Description: ${item.description}`);
      }

      if (item.accounts_email) {
        detailLineTexts.push(`Email Contact: ${item.accounts_email}`);
      }

      if (item.client_address) {
        detailLineTexts.push(`Address: ${item.client_address}`);
      }

      const wrappedDetailLines: string[] = [];
      const maxDetailWidth = contentWidth - 20;

      for (const text of detailLineTexts) {
        const wrapped = wrapText(text, maxDetailWidth, font, detailTextSize);
        if (wrapped.length === 0) {
          continue;
        }
        wrappedDetailLines.push(...wrapped);
      }

      const totalLinesForItem = 1 + wrappedDetailLines.length + 1;

      ensureSpaceForLines(totalLinesForItem);

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

      const detailIndentX = leftMargin + 10;

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

    if (y < bottomMargin + 20) {
      page.drawText("Continued on next page...", {
        x: leftMargin,
        y: bottomMargin - 15,
        size: 8,
        font,
      });
      page = pdfDoc.addPage();
      y = height - topMargin - 20;
    }

    const totalText = `Total Invoiced Value: ${formatCurrency(totalValue)}`;
    page.drawText(totalText, {
      x: leftMargin,
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

    const responseBody: { error: string; details?: string } = {
      error: "Failed to generate invoice PDF",
    };

    if (process.env.NODE_ENV !== "production") {
      responseBody.details = message;
    }

    res.status(500).json(responseBody);
  }
}