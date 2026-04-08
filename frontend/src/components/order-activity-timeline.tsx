import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  Package,
  Send,
  CheckCircle,
  FileText,
  TruckIcon,
  Bell,
  User,
  Edit,
  Plus,
  Minus,
  Scale,
  Calendar,
} from "lucide-react";

interface OrderActivityTimelineProps {
  orderId: string;
}

// Map activity types to icons and colors
const activityConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }
> = {
  ORDER_CREATED: { icon: Plus, color: "text-primary", bgColor: "bg-primary/10" },
  ORDER_SUBMITTED: { icon: Send, color: "text-success", bgColor: "bg-success/10" },
  ORDER_STATUS_CHANGED: { icon: Package, color: "text-primary", bgColor: "bg-primary/10" },
  ORDER_FINALIZED: { icon: CheckCircle, color: "text-success", bgColor: "bg-success/10" },
  ORDER_CANCELLED: { icon: Minus, color: "text-destructive", bgColor: "bg-destructive/10" },
  ITEM_ADDED: { icon: Plus, color: "text-primary", bgColor: "bg-primary/10" },
  ITEM_REMOVED: { icon: Minus, color: "text-destructive", bgColor: "bg-destructive/10" },
  ITEM_QUANTITY_CHANGED: { icon: Edit, color: "text-warning", bgColor: "bg-warning/10" },
  ITEM_WEIGHED: { icon: Scale, color: "text-primary", bgColor: "bg-primary/10" },
  ITEM_PRICE_UPDATED: { icon: Edit, color: "text-warning", bgColor: "bg-warning/10" },
  NOTE_ADDED: { icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted" },
  NOTE_UPDATED: { icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted" },
  DELIVERY_SCHEDULED: { icon: Calendar, color: "text-primary", bgColor: "bg-primary/10" },
  DELIVERY_RESCHEDULED: { icon: Calendar, color: "text-primary", bgColor: "bg-primary/10" },
  DELIVERY_COMPLETED: { icon: TruckIcon, color: "text-success", bgColor: "bg-success/10" },
  PDF_GENERATED: { icon: FileText, color: "text-primary", bgColor: "bg-primary/10" },
  NOTIFICATION_SENT: { icon: Bell, color: "text-primary", bgColor: "bg-primary/10" },
};

const defaultConfig = {
  icon: Clock,
  color: "text-muted-foreground",
  bgColor: "bg-muted",
};

export function OrderActivityTimeline({ orderId }: OrderActivityTimelineProps) {
  const activitiesQuery = trpc.orders.getActivities.useQuery({ orderId });

  if (activitiesQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-muted"></div>
            </div>
            <div className="flex-1">
              <div className="h-4 w-3/4 bg-muted rounded mb-2"></div>
              <div className="h-3 w-1/2 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activitiesQuery.isError) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
        <p className="text-destructive text-sm">
          Falha ao carregar histórico: {activitiesQuery.error.message}
        </p>
      </div>
    );
  }

  const activities = activitiesQuery.data || [];

  if (activities.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border"></div>

      {/* Activities */}
      <div className="space-y-6">
        {activities.map((activity, index) => {
          const config = activityConfig[activity.activityType] || defaultConfig;
          const Icon = config.icon;
          const isFirst = index === 0;

          return (
            <div key={activity.id} className="relative flex gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 relative z-10">
                <div
                  className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center ${isFirst ? "ring-4 ring-white shadow-md" : ""
                    }`}
                >
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className={`${isFirst ? "bg-card p-4 rounded-lg border shadow-sm" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`${isFirst ? "font-semibold" : "font-medium"} text-sm text-card-foreground`}>
                        {activity.description}
                      </p>

                      {activity.user && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {activity.user.name || activity.user.email}
                          </p>
                        </div>
                      )}

                      {/* Metadata - if needed */}
                      {activity.metadata && typeof activity.metadata === 'object' && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {Object.entries(activity.metadata as Record<string, unknown>).map(([key, value]) => {
                            // Skip displaying internal keys
                            if (['oldValue', 'newValue'].includes(key)) return null;

                            return (
                              <div key={key} className="flex gap-2">
                                <span className="font-medium capitalize">{key}:</span>
                                <span>{String(value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {new Date(activity.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
