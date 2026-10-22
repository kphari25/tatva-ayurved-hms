import { invoiceTemplate, invoiceCopyTemplate, toLocalDate } from './whatsapp';
import { buildMedicineSalePdfBase64, medicineSalePdfFilename } from './invoicePdf';

// Dialog props for sending a saved Medicine Sale bill on WhatsApp: the bill
// itself as a PDF through the invoice_copy template (always attached — there is
// no patient-style text template for a counter sale), with a plain text message
// as the one-click chat fallback.
export const medicineBillDialog = (sale) => {
  const name = sale.customer_name || 'Customer';
  const date = sale.sale_date || sale.created_at;
  const copyData = { invoice_number: sale.bill_number, invoice_date: date, total_amount: sale.total_amount };
  return {
    phone: sale.phone,
    // Used only if the PDF option is switched off server-side: the invoice text template.
    template: invoiceTemplate(name, {
      invoice_date: date,
      invoice_type: 'Medicine',
      total_amount: sale.total_amount,
      payment_mode: sale.payment_mode,
      patient_number: sale.mrd_number || sale.bill_number,
    }),
    chatMessage: `Dear ${name}, Your medicine bill ${sale.bill_number} at Tatva Ayurved dated ${toLocalDate(date).toLocaleDateString('en-IN')} is generated. Total Amount: Rs.${Number(sale.total_amount).toFixed(2)}. Payment Mode: ${sale.payment_mode}. Thank you! - Tatva Ayurved`,
    invoiceCopy: {
      required: true,
      template: invoiceCopyTemplate(name, copyData),
      buildPdf: () => buildMedicineSalePdfBase64(sale),
      filename: medicineSalePdfFilename(sale),
    },
  };
};
