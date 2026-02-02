import twilio from "twilio";
import type { Order, OrderItem, ProductOption, Product } from "@prisma/client";
import { logger } from "./logger.js";

/**
 * WhatsApp Business API integration using Twilio
 *
 * Required environment variables:
 * - TWILIO_ACCOUNT_SID: Twilio account SID
 * - TWILIO_AUTH_TOKEN: Twilio auth token
 * - TWILIO_WHATSAPP_NUMBER: Your Twilio WhatsApp number (e.g., whatsapp:+14155238886)
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

let twilioClient: ReturnType<typeof twilio> | null = null;

/**
 * Initialize Twilio client if credentials are configured
 */
function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    logger.warn(
      "WhatsApp integration not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER to enable."
    );
    return null;
  }

  if (!twilioClient) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  return twilioClient;
}

/**
 * Format price in BRL currency
 */
function formatPrice(priceInCents: number): string {
  return `R$ ${(priceInCents / 100).toFixed(2)}`;
}

/**
 * Send WhatsApp message
 */
async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const client = getTwilioClient();
  if (!client) {
    logger.debug(`[WhatsApp] Would send to ${to}: ${body}`);
    return;
  }

  try {
    const message = await client.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
      body,
    });

    logger.info(`[WhatsApp] Message sent: ${message.sid}`);
  } catch (error) {
    logger.error(`[WhatsApp] Failed to send message:`, error);
    throw error;
  }
}

/**
 * Message Templates
 */

export interface OrderWithItems extends Order {
  items: Array<
    OrderItem & {
      productOption: ProductOption & {
        product: Product;
      };
    }
  >;
}

export async function sendOrderCreatedNotification(
  phoneNumber: string,
  order: OrderWithItems,
  customerName: string
): Promise<void> {
  const itemCount = order.items.length;

  // Calculate estimated total for FIXED items
  let estimatedTotal = 0;
  const itemsText = order.items
    .slice(0, 8) // Show more items
    .map((item) => {
      const qty = item.requestedQty;
      const unit = item.productOption.unitType === "FIXED" ? "un" : "kg";
      let priceInfo = "";

      if (item.finalPrice) {
        estimatedTotal += item.finalPrice;
        priceInfo = ` - ${formatPrice(item.finalPrice)}`;
      }

      return `  ${item.productOption.product.name}\n  ${item.productOption.name} - ${qty} ${unit}${priceInfo}`;
    })
    .join("\n\n");

  const moreText = itemCount > 8 ? `\n\n  ... e mais ${itemCount - 8} itens` : "";

  const totalText = estimatedTotal > 0
    ? `\n\n💰 *Total Estimado:* ${formatPrice(estimatedTotal)}\n(Produtos pesados podem ter pequenas variações)`
    : "";

  const orderUrl = process.env.APP_BASE_URL
    ? `\n\n📱 Ver pedido: ${process.env.APP_BASE_URL}/chef/orders`
    : "";

  const message = `✅ *Pedido Confirmado!*

Olá *${customerName}*! 👋

Recebemos seu pedido *#${order.orderNumber}* com sucesso!

📦 *PRODUTOS:*

${itemsText}${moreText}${totalText}

⏰ *Próximos passos:*
→ Separação dos produtos
→ Pesagem e conferência
→ Notificação quando pronto${orderUrl}

Qualquer dúvida, estamos à disposição! 💚

_FreshFlow - Hortifrúti Fresco Sempre_ 🥬🍅`;

  await sendWhatsAppMessage(phoneNumber, message);
}

export async function sendOrderInSeparationNotification(
  phoneNumber: string,
  order: Order,
  customerName: string
): Promise<void> {
  const message = `📦 *Pedido em Separação*

Olá ${customerName}!

Seu pedido #${order.orderNumber} está sendo separado por nossa equipe.

Os produtos estão sendo pesados e conferidos. Em breve seu pedido estará pronto!

Status: Em Separação 📋`;

  await sendWhatsAppMessage(phoneNumber, message);
}

export async function sendOrderFinalizedNotification(
  phoneNumber: string,
  order: OrderWithItems,
  customerName: string,
  totalAmount: number,
  pdfUrl?: string
): Promise<void> {
  // Show item breakdown
  const itemsText = order.items
    .slice(0, 10)
    .map((item) => {
      const qty = item.actualWeight || item.requestedQty;
      const unit = item.productOption.unitType === "FIXED" ? "un" : "kg";
      const price = item.finalPrice ? formatPrice(item.finalPrice) : "—";
      return `  • ${item.productOption.product.name} (${qty} ${unit}) - ${price}`;
    })
    .join("\n");

  const moreText = order.items.length > 10 ? `\n  ... e mais ${order.items.length - 10} itens` : "";

  const pdfText = pdfUrl
    ? `\n\n📄 *Extrato de Conferência:*\n${pdfUrl}`
    : "";

  const orderUrl = process.env.APP_BASE_URL
    ? `\n\n📱 Ver detalhes: ${process.env.APP_BASE_URL}/chef/orders`
    : "";

  const message = `🎉 *Pedido Pronto para Entrega!*

Olá *${customerName}*!

Seu pedido *#${order.orderNumber}* foi finalizado! ✅

📦 *RESUMO:*

${itemsText}${moreText}

━━━━━━━━━━━━━━━━
💰 *TOTAL: ${formatPrice(totalAmount)}*
━━━━━━━━━━━━━━━━

✅ Todos os produtos foram pesados e conferidos${pdfText}${orderUrl}

📞 Dúvidas? Estamos à disposição!

_FreshFlow - Qualidade Garantida_ 💚`;

  await sendWhatsAppMessage(phoneNumber, message);
}

export async function sendWeighingUpdateNotification(
  phoneNumber: string,
  orderNumber: string,
  productName: string,
  actualWeight: number,
  finalPrice: number
): Promise<void> {
  const message = `⚖️ *Produto Pesado*

Pedido #${orderNumber}

*Produto:* ${productName}
*Peso:* ${actualWeight.toFixed(3)} kg
*Valor:* ${formatPrice(finalPrice)}

Pesagem registrada com sucesso!`;

  await sendWhatsAppMessage(phoneNumber, message);
}

export async function sendPaymentReminderNotification(
  phoneNumber: string,
  orderNumber: string,
  totalAmount: number,
  dueDate: Date,
  pixKey?: string
): Promise<void> {
  const dueDateStr = dueDate.toLocaleDateString("pt-BR");
  const pixText = pixKey
    ? `\n\n💳 *Pix Copia e Cola:*\n\`${pixKey}\`\n\n_(Toque para copiar)_`
    : "";

  const message = `💰 *Lembrete de Pagamento*

Pedido *#${orderNumber}*

*Valor:* ${formatPrice(totalAmount)}
*Vencimento:* ${dueDateStr}${pixText}

Para pagamentos via Pix, use a chave acima ou acesse nosso sistema para gerar o QR Code.

_FreshFlow - Obrigado!_ 💚`;

  await sendWhatsAppMessage(phoneNumber, message);
}

export async function sendPromotionNotification(
  phoneNumber: string,
  customerName: string,
  promotionTitle: string,
  promotionDescription: string,
  catalogUrl?: string
): Promise<void> {
  const catalogText = catalogUrl
    ? `\n\n🛒 Ver produtos: ${catalogUrl}`
    : "";

  const message = `🎊 *Promoção Especial!*

Olá *${customerName}*!

*${promotionTitle}*

${promotionDescription}${catalogText}

⏰ Promoção por tempo limitado!

Faça seu pedido agora! 💚

_FreshFlow - Sempre com as melhores ofertas_ 🥬🍅`;

  await sendWhatsAppMessage(phoneNumber, message);
}

export async function sendCustomMessage(
  phoneNumber: string,
  message: string
): Promise<void> {
  await sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Webhook handler for incoming WhatsApp messages
 *
 * This function processes incoming messages from customers
 * and can be extended to handle commands like:
 * - Check order status
 * - Request help
 * - Confirm delivery
 */
export async function handleIncomingMessage(
  _from: string,
  body: string
): Promise<string | null> {
  const normalizedBody = body.toLowerCase().trim();

  // Auto-reply based on message content
  if (normalizedBody.includes("status") || normalizedBody.includes("pedido")) {
    return `Olá! Para consultar o status do seu pedido, acesse nosso sistema ou entre em contato com nossa equipe.

Estamos à disposição! 🌱`;
  }

  if (normalizedBody.includes("ajuda") || normalizedBody.includes("help")) {
    return `*FreshFlow - Menu de Ajuda*

🛒 Fazer pedido
📦 Consultar status
📞 Falar com atendente

Como podemos ajudar?`;
  }

  if (normalizedBody.includes("oi") || normalizedBody.includes("olá")) {
    return `Olá! Bem-vindo à FreshFlow! 🌱

Como podemos ajudá-lo hoje?`;
  }

  // Return null if no auto-reply is needed (will be handled by human)
  return null;
}

/**
 * Parse phone number to international format
 */
export function parsePhoneNumber(phone: string): string {
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, "");

  // Add Brazil country code if not present
  if (!cleaned.startsWith("55")) {
    return `+55${cleaned}`;
  }

  return `+${cleaned}`;
}
