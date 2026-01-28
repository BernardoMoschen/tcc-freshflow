import twilio from "twilio";
import type { Order, OrderItem, ProductOption, Product } from "@prisma/client";

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
    console.warn(
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
    console.log(`[WhatsApp] Would send to ${to}: ${body}`);
    return;
  }

  try {
    const message = await client.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
      body,
    });

    console.log(`[WhatsApp] Message sent: ${message.sid}`);
  } catch (error) {
    console.error(`[WhatsApp] Failed to send message:`, error);
    throw error;
  }
}

/**
 * Message Templates
 */

interface OrderWithItems extends Order {
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
  const itemsText = order.items
    .slice(0, 5)
    .map(
      (item) =>
        `• ${item.productOption.product.name} - ${item.productOption.name} (${item.requestedQty} ${item.productOption.unitType === "FIXED" ? "un" : "kg"})`
    )
    .join("\n");

  const moreText = itemCount > 5 ? `\n... e mais ${itemCount - 5} itens` : "";

  const message = `🛒 *Novo Pedido Recebido*

Olá! Recebemos seu pedido #${order.orderNumber}

*Cliente:* ${customerName}
*Itens:* ${itemCount}

${itemsText}${moreText}

Estamos processando seu pedido. Você receberá uma notificação quando estiver pronto para entrega.

Obrigado por escolher a FreshFlow! 🌱`;

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
  const pdfText = pdfUrl
    ? `\n\nBaixe seu extrato de conferência:\n${pdfUrl}`
    : "\n\nSeu extrato de conferência estará disponível em breve.";

  const message = `✅ *Pedido Finalizado*

Olá ${customerName}!

Seu pedido #${order.orderNumber} foi finalizado e está pronto para entrega! 🎉

*Valor Total:* ${formatPrice(totalAmount)}

Todos os itens foram pesados e conferidos. ${pdfText}

Qualquer dúvida, estamos à disposição!

Equipe FreshFlow 🌱`;

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
