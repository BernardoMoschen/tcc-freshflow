import { PrismaClient, OrderActivityType, OrderStatus } from "@prisma/client";

/**
 * Service for tracking order activities
 * Creates audit trail entries for all significant order events
 */

interface ActivityMetadata {
  oldValue?: unknown;
  newValue?: unknown;
  itemName?: string;
  quantity?: number;
  [key: string]: unknown;
}

export class ActivityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log an activity for an order
   */
  async logActivity(params: {
    orderId: string;
    activityType: OrderActivityType;
    userId?: string;
    description: string;
    metadata?: ActivityMetadata;
  }) {
    const { orderId, activityType, userId, description, metadata } = params;

    await this.prisma.orderActivity.create({
      data: {
        orderId,
        activityType,
        userId: userId || null,
        description,
        metadata: metadata || null,
      },
    });
  }

  /**
   * Log order creation
   */
  async logOrderCreated(orderId: string, userId: string) {
    await this.logActivity({
      orderId,
      activityType: "ORDER_CREATED",
      userId,
      description: "Pedido criado",
    });
  }

  /**
   * Log order submission (DRAFT → SENT)
   */
  async logOrderSubmitted(orderId: string, userId: string, orderNumber: string) {
    await this.logActivity({
      orderId,
      activityType: "ORDER_SUBMITTED",
      userId,
      description: `Pedido ${orderNumber} enviado`,
    });
  }

  /**
   * Log status change
   */
  async logStatusChange(
    orderId: string,
    userId: string | undefined,
    oldStatus: OrderStatus,
    newStatus: OrderStatus
  ) {
    const statusTranslations: Record<OrderStatus, string> = {
      DRAFT: "Rascunho",
      SENT: "Enviado",
      IN_SEPARATION: "Em Separação",
      FINALIZED: "Finalizado",
    };

    await this.logActivity({
      orderId,
      activityType: "ORDER_STATUS_CHANGED",
      userId,
      description: `Status alterado de ${statusTranslations[oldStatus]} para ${statusTranslations[newStatus]}`,
      metadata: {
        oldValue: oldStatus,
        newValue: newStatus,
      },
    });
  }

  /**
   * Log order finalization
   */
  async logOrderFinalized(orderId: string, userId: string) {
    await this.logActivity({
      orderId,
      activityType: "ORDER_FINALIZED",
      userId,
      description: "Pedido finalizado",
    });
  }

  /**
   * Log item added
   */
  async logItemAdded(
    orderId: string,
    userId: string,
    itemName: string,
    quantity: number
  ) {
    await this.logActivity({
      orderId,
      activityType: "ITEM_ADDED",
      userId,
      description: `Item adicionado: ${itemName} (${quantity})`,
      metadata: {
        itemName,
        quantity,
      },
    });
  }

  /**
   * Log item removed
   */
  async logItemRemoved(
    orderId: string,
    userId: string,
    itemName: string
  ) {
    await this.logActivity({
      orderId,
      activityType: "ITEM_REMOVED",
      userId,
      description: `Item removido: ${itemName}`,
      metadata: {
        itemName,
      },
    });
  }

  /**
   * Log quantity change
   */
  async logQuantityChanged(
    orderId: string,
    userId: string,
    itemName: string,
    oldQty: number,
    newQty: number
  ) {
    await this.logActivity({
      orderId,
      activityType: "ITEM_QUANTITY_CHANGED",
      userId,
      description: `Quantidade alterada: ${itemName} (${oldQty} → ${newQty})`,
      metadata: {
        itemName,
        oldValue: oldQty,
        newValue: newQty,
      },
    });
  }

  /**
   * Log item weighed
   */
  async logItemWeighed(
    orderId: string,
    userId: string,
    itemName: string,
    weight: number
  ) {
    await this.logActivity({
      orderId,
      activityType: "ITEM_WEIGHED",
      userId,
      description: `Item pesado: ${itemName} (${weight}kg)`,
      metadata: {
        itemName,
        weight,
      },
    });
  }

  /**
   * Log note added
   */
  async logNoteAdded(orderId: string, userId: string, noteContent: string) {
    const preview = noteContent.length > 50
      ? noteContent.substring(0, 50) + "..."
      : noteContent;

    await this.logActivity({
      orderId,
      activityType: "NOTE_ADDED",
      userId,
      description: `Observação adicionada: "${preview}"`,
      metadata: {
        note: noteContent,
      },
    });
  }

  /**
   * Log delivery scheduled
   */
  async logDeliveryScheduled(
    orderId: string,
    userId: string,
    deliveryDate: Date,
    timeSlot?: string
  ) {
    const dateStr = deliveryDate.toLocaleDateString("pt-BR");
    const description = timeSlot
      ? `Entrega agendada para ${dateStr} (${timeSlot})`
      : `Entrega agendada para ${dateStr}`;

    await this.logActivity({
      orderId,
      activityType: "DELIVERY_SCHEDULED",
      userId,
      description,
      metadata: {
        deliveryDate: deliveryDate.toISOString(),
        timeSlot,
      },
    });
  }

  /**
   * Log PDF generated
   */
  async logPDFGenerated(orderId: string, userId?: string) {
    await this.logActivity({
      orderId,
      activityType: "PDF_GENERATED",
      userId,
      description: "Nota de entrega (PDF) gerada",
    });
  }

  /**
   * Log WhatsApp notification sent
   */
  async logNotificationSent(
    orderId: string,
    notificationType: string,
    recipient: string
  ) {
    await this.logActivity({
      orderId,
      activityType: "NOTIFICATION_SENT",
      description: `Notificação enviada via WhatsApp: ${notificationType}`,
      metadata: {
        notificationType,
        recipient,
      },
    });
  }

  /**
   * Get all activities for an order
   */
  async getOrderActivities(orderId: string) {
    return this.prisma.orderActivity.findMany({
      where: { orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
