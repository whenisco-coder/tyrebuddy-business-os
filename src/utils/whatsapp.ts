import { Order, BusinessSettings } from '../types';
import { formatINR } from './gst';
import { buildUpiPayUri } from './barcode';

export function cleanPhoneNumber(phone: string): string {
  // Strip non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return '91' + digits; // Add default India country code
  }
  return digits;
}

export function openWhatsAppLink(phone: string, text: string) {
  const target = cleanPhoneNumber(phone);
  const encoded = encodeURIComponent(text);
  const url = `https://wa.me/${target}?text=${encoded}`;
  window.open(url, '_blank');
}

export function generateOrderConfirmationMessage(order: Order, business: BusinessSettings): string {
  const itemsText = order.items
    .map(
      (it, idx) =>
        `${idx + 1}. ${it.name} (Qty: ${it.qty}) - ${formatINR(it.totalAmount)}`
    )
    .join('\n');

  return `*${business.businessName}*
Order Confirmation

Dear ${order.customerName},
Thank you for your order! Your order *${order.orderNo}* has been confirmed.

*Order Summary:*
${itemsText}

*Total Amount:* ${formatINR(order.grandTotal)}
*Payment Status:* ${order.paymentStatus}
*Delivery Status:* ${order.deliveryStatus}

Shipping to:
${order.shippingAddress.addressLine}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}

For any inquiries, feel free to message us here!`;
}

export function generateShippingTrackingMessage(order: Order, business: BusinessSettings): string {
  return `*${business.businessName}*
Dispatch & Tracking Update

Dear ${order.customerName},
Your order *${order.orderNo}* has been packed and dispatched!

*Courier Partner:* ${order.courierName || 'Standard Express'}
*AWB / Tracking No:* ${order.awbNumber || 'Generating...'}
*Destination:* ${order.shippingAddress.city}, ${order.shippingAddress.state}

Expected delivery in 2-4 business days. Track your parcel on the courier portal using the AWB above.

Thank you for choosing ${business.businessName}!`;
}

export function generatePaymentReminderMessage(
  order: Order,
  business: BusinessSettings,
  dueAmount?: number
): string {
  const balance = dueAmount !== undefined ? dueAmount : (order.grandTotal - order.amountPaid);
  const upiLink = buildUpiPayUri(
    business.upiId,
    business.businessName,
    balance,
    `Payment for ${order.orderNo}`
  );

  return `*${business.businessName}*
Payment Reminder

Dear ${order.customerName},
This is a gentle reminder regarding pending payment of *${formatINR(balance)}* for Order *${order.orderNo}* (Due: ${order.dueDate}).

*Quick UPI Payment:*
${upiLink}
*UPI ID:* \`${business.upiId}\`

*Bank Transfer Details:*
Bank: ${business.bankName}
A/C Name: ${business.accountName}
A/C No: ${business.accountNumber}
IFSC: ${business.ifscCode}

Please share screenshot once paid. Thank you!`;
}

export function generateReviewRequestMessage(order: Order, business: BusinessSettings): string {
  return `*${business.businessName}*
Customer Feedback & Review

Dear ${order.customerName},
We hope your tyres / spares for order *${order.orderNo}* reached you safely and in top condition!

Your feedback helps our team maintain top quality service across Gujarat and India.
Could you take 30 seconds to reply with a rating (1 to 5 stars) or share your experience?

Thank you for your valuable patronage!`;
}
