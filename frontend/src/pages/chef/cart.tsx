import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeNotes } from "@/lib/sanitize";
import { toast } from "sonner";
import { Calendar, MessageSquare, Trash2, AlertTriangle, ShoppingBag, Clock, Truck } from "lucide-react";

const MAX_ITEM_NOTES_LENGTH = 200;
const MAX_ORDER_NOTES_LENGTH = 500;

export function CartPage() {
  const { items, updateQuantity, updateNotes, removeItem, clear, subtotal, draftOrderId, isSyncing } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  // Request deduplication ref
  const isSubmittingRef = useRef(false);

  const submitDraftMutation = trpc.orders.submitDraft.useMutation();

  // Fetch delivery settings from tenant
  const deliverySettingsQuery = trpc.tenantSettings.getAvailableDeliveryDates.useQuery();

  // Set default delivery date based on tenant settings
  useState(() => {
    // Will be updated when deliverySettingsQuery loads
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDeliveryDate(tomorrow.toISOString().split("T")[0]);
  });

  // Update default date when settings load
  useEffect(() => {
    if (deliverySettingsQuery.data) {
      const minDays = deliverySettingsQuery.data.minDaysAhead;
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + minDays);
      setDeliveryDate(defaultDate.toISOString().split("T")[0]);
    }
  }, [deliverySettingsQuery.data]);

  const handleSubmit = useCallback(async () => {
    // Prevent duplicate submissions
    if (isSubmittingRef.current || submitting) return;

    if (items.length === 0) {
      toast.error("Carrinho vazio", {
        description: "Adicione produtos antes de enviar o pedido.",
      });
      return;
    }

    if (!draftOrderId) {
      toast.error("Rascunho do pedido não encontrado", {
        description: "Tente recarregar a página.",
      });
      return;
    }

    // Validate delivery date
    if (!deliveryDate) {
      toast.error("Data de entrega obrigatória", {
        description: "Selecione uma data de entrega para o pedido.",
      });
      return;
    }

    const selectedDate = new Date(deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      toast.error("Data inválida", {
        description: "A data de entrega não pode ser no passado.",
      });
      return;
    }

    // Validate against tenant settings
    if (deliverySettingsQuery.data) {
      const weekday = selectedDate.getDay();
      if (!deliverySettingsQuery.data.allowedWeekdays.includes(weekday)) {
        const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        toast.error("Data inválida", {
          description: `Entregas não são permitidas às ${weekdayNames[weekday]}s.`,
        });
        return;
      }

      const daysFromNow = Math.floor((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const minDays = deliverySettingsQuery.data.allowSameDay ? 0 : deliverySettingsQuery.data.minDaysAhead;

      if (daysFromNow < minDays) {
        toast.error("Data inválida", {
          description: `A entrega deve ser agendada com pelo menos ${minDays} dia(s) de antecedência.`,
        });
        return;
      }

      if (daysFromNow > deliverySettingsQuery.data.maxDaysAhead) {
        toast.error("Data inválida", {
          description: `A entrega não pode ser agendada com mais de ${deliverySettingsQuery.data.maxDaysAhead} dias de antecedência.`,
        });
        return;
      }
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const order = await submitDraftMutation.mutateAsync({
        orderId: draftOrderId,
        requestedDeliveryDate: deliveryDate,
        deliveryTimeSlot: deliveryTimeSlot || undefined,
        deliveryInstructions: deliveryInstructions || undefined,
        notes: orderNotes || undefined,
      });

      const timeSlotText = deliveryTimeSlot ? ` (${deliveryTimeSlot})` : "";
      toast.success(`Pedido enviado: ${order.orderNumber}`, {
        description: `Agendado para ${new Date(deliveryDate).toLocaleDateString("pt-BR")}${timeSlotText}`,
      });
      navigate("/chef/orders");
    } catch (error) {
      toast.error("Falha ao enviar pedido", {
        description: error instanceof Error ? error.message : "Erro desconhecido. Tente novamente.",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [items.length, draftOrderId, deliveryDate, submitDraftMutation, navigate, submitting]);

  const handleRemoveItem = useCallback((productOptionId: string) => {
    removeItem(productOptionId);
    toast.success("Item removido do carrinho");
    setItemToRemove(null);
  }, [removeItem]);

  const handleClearCart = useCallback(() => {
    clear();
    toast.success("Carrinho limpo", {
      description: "Todos os itens foram removidos.",
    });
    setShowClearConfirm(false);
  }, [clear]);

  const handleQuantityChange = useCallback((productOptionId: string, value: string) => {
    const qty = parseFloat(value);
    if (!isNaN(qty) && qty >= 0.1) {
      updateQuantity(productOptionId, qty);
    }
  }, [updateQuantity]);

  const handleNotesChange = useCallback((productOptionId: string, value: string) => {
    // Allow unrestricted input while typing, only limit length
    if (value.length <= MAX_ITEM_NOTES_LENGTH) {
      updateNotes(productOptionId, value);
    }
  }, [updateNotes]);

  const handleNotesBlur = useCallback((productOptionId: string, value: string) => {
    // Sanitize only on blur to prevent XSS while allowing natural typing
    const sanitized = sanitizeNotes(value);
    if (sanitized !== value) {
      updateNotes(productOptionId, sanitized);
    }
  }, [updateNotes]);

  const handleOrderNotesChange = useCallback((value: string) => {
    // Allow unrestricted input while typing, only limit length
    if (value.length <= MAX_ORDER_NOTES_LENGTH) {
      setOrderNotes(value);
    }
  }, []);

  const handleOrderNotesBlur = useCallback((value: string) => {
    // Sanitize only on blur to prevent XSS while allowing natural typing
    const sanitized = sanitizeNotes(value);
    if (sanitized !== value) {
      setOrderNotes(sanitized);
    }
  }, []);

  // Generate quick date options based on tenant settings
  const getAvailableQuickDates = () => {
    if (!deliverySettingsQuery.data) return [];

    const { minDaysAhead, maxDaysAhead, allowedWeekdays, allowSameDay } = deliverySettingsQuery.data;
    const quickDates: { date: string; label: string; daysAhead: number }[] = [];
    const today = new Date();
    const startDays = allowSameDay ? 0 : minDaysAhead;

    let daysChecked = 0;
    let daysAhead = startDays;

    // Generate up to 4 quick date options
    while (quickDates.length < 4 && daysAhead <= maxDaysAhead && daysChecked < 30) {
      const date = new Date(today);
      date.setDate(date.getDate() + daysAhead);
      const weekday = date.getDay();

      // Check if this weekday is allowed
      if (allowedWeekdays.includes(weekday)) {
        const dateStr = date.toISOString().split("T")[0];
        let label: string;

        if (daysAhead === 0) {
          label = "Hoje";
        } else if (daysAhead === 1) {
          label = "Amanhã";
        } else {
          label = date.toLocaleDateString("pt-BR", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
        }

        quickDates.push({ date: dateStr, label, daysAhead });
      }

      daysAhead++;
      daysChecked++;
    }

    return quickDates;
  };

  const quickDates = getAvailableQuickDates();

  return (
    <PageLayout title="Carrinho">
      {items.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="mx-auto h-16 w-16 text-gray-400" aria-hidden="true" />
          <p className="mt-4 text-lg font-medium text-foreground">Seu carrinho está vazio</p>
          <p className="mt-1 text-sm text-muted-foreground">Adicione produtos do catálogo para começar</p>
          <Button onClick={() => navigate("/chef/catalog")} className="mt-6" size="lg">
            Ver Catálogo
          </Button>
        </div>
      ) : (
        <>
          {/* Header with clear button */}
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "itens"} no carrinho
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="text-red-600 hover:text-red-800 hover:bg-red-50"
              disabled={isSyncing}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar Carrinho
            </Button>
          </div>

          {/* Cart items */}
          <div className="space-y-4 mb-6">
            {items.map((item) => (
              <div key={item.productOptionId} className="bg-card rounded-lg shadow-sm p-4 md:p-6">
                <div className="flex flex-col gap-4">
                  {/* Item header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base md:text-lg">{item.productName}</h3>
                      <p className="text-sm text-muted-foreground">{item.optionName}</p>
                      <p className="text-sm font-medium text-primary mt-1">
                        R$ {(item.price / 100).toFixed(2)}
                        {item.unitType === "WEIGHT" && " /kg"}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setItemToRemove({ id: item.productOptionId, name: item.productName })}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 h-11 w-11"
                      disabled={isSyncing}
                      aria-label={`Remover ${item.productName} do carrinho`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

                  {/* Controles de quantidade */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor={`qty-${item.productOptionId}`} className="text-sm font-medium">
                      Quantidade:
                    </Label>
                    <Input
                      id={`qty-${item.productOptionId}`}
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.requestedQty}
                      onChange={(e) => handleQuantityChange(item.productOptionId, e.target.value)}
                      className="w-24"
                      disabled={isSyncing}
                      aria-describedby={`unit-${item.productOptionId}`}
                    />
                    <span id={`unit-${item.productOptionId}`} className="text-sm text-muted-foreground">
                      {item.unitType === "WEIGHT" ? "kg" : "unidades"}
                    </span>
                    <div className="ml-auto text-right">
                      <span className="text-sm text-muted-foreground">Subtotal: </span>
                      <span className="font-semibold text-primary">
                        R$ {((item.price * item.requestedQty) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Observações do item */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`notes-${item.productOptionId}`}
                        className="text-xs text-muted-foreground flex items-center gap-1"
                      >
                        <MessageSquare className="h-3 w-3" aria-hidden="true" />
                        Instruções especiais (opcional)
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {(item.notes?.length || 0)}/{MAX_ITEM_NOTES_LENGTH}
                      </span>
                    </div>
                    <Textarea
                      id={`notes-${item.productOptionId}`}
                      placeholder={`Ex: "Cortar ao meio", "Bem fresco", "Sem substituições"...`}
                      value={item.notes || ""}
                      onChange={(e) => handleNotesChange(item.productOptionId, e.target.value)}
                      onBlur={(e) => handleNotesBlur(item.productOptionId, e.target.value)}
                      className="text-sm resize-none"
                      rows={2}
                      maxLength={MAX_ITEM_NOTES_LENGTH}
                      disabled={isSyncing}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order details section */}
          <div className="bg-card rounded-lg shadow-sm p-6 space-y-6 mb-6">
            <h3 className="font-semibold text-lg">Detalhes do Pedido</h3>

            {/* Delivery Date */}
            <div className="space-y-3">
              <Label htmlFor="deliveryDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Data de Entrega <span className="text-red-500">*</span>
              </Label>

              {/* Quick date buttons */}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de data">
                {quickDates.map((option) => (
                  <Button
                    key={option.date}
                    type="button"
                    variant={deliveryDate === option.date ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDeliveryDate(option.date)}
                  >
                    {option.label}
                  </Button>
                ))}
                {quickDates.length === 0 && deliverySettingsQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">Carregando datas disponíveis...</p>
                )}
                {quickDates.length === 0 && !deliverySettingsQuery.isLoading && (
                  <p className="text-sm text-warning">Nenhuma data de entrega disponível no momento</p>
                )}
              </div>

              {/* Date picker */}
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={(() => {
                  if (!deliverySettingsQuery.data) return new Date().toISOString().split("T")[0];
                  const minDate = new Date();
                  const minDays = deliverySettingsQuery.data.allowSameDay
                    ? 0
                    : deliverySettingsQuery.data.minDaysAhead;
                  minDate.setDate(minDate.getDate() + minDays);
                  return minDate.toISOString().split("T")[0];
                })()}
                max={(() => {
                  if (!deliverySettingsQuery.data) return undefined;
                  const maxDate = new Date();
                  maxDate.setDate(maxDate.getDate() + deliverySettingsQuery.data.maxDaysAhead);
                  return maxDate.toISOString().split("T")[0];
                })()}
                className="w-full"
                required
                aria-required="true"
              />
            </div>

            {/* Delivery Time Slot */}
            <div className="space-y-3">
              <Label htmlFor="deliveryTimeSlot" className="flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Horário de Entrega (opcional)
              </Label>
              <Select value={deliveryTimeSlot} onValueChange={setDeliveryTimeSlot}>
                <SelectTrigger id="deliveryTimeSlot" className="w-full">
                  <SelectValue placeholder="Selecione um horário" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    // Use tenant-configured time slots if available for the selected day
                    if (deliverySettingsQuery.data?.timeSlots && deliveryDate) {
                      const selectedWeekday = new Date(deliveryDate).getDay();
                      const slotsForDay = deliverySettingsQuery.data.timeSlots[selectedWeekday.toString()];

                      if (slotsForDay && slotsForDay.length > 0) {
                        return slotsForDay.map((slot: string) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ));
                      }
                    }

                    // Fallback to default time slots
                    return (
                      <>
                        <SelectItem value="06:00-09:00">Manhã Cedo (06:00 - 09:00)</SelectItem>
                        <SelectItem value="09:00-12:00">Manhã (09:00 - 12:00)</SelectItem>
                        <SelectItem value="12:00-15:00">Tarde (12:00 - 15:00)</SelectItem>
                        <SelectItem value="15:00-18:00">Tarde Final (15:00 - 18:00)</SelectItem>
                        <SelectItem value="18:00-21:00">Noite (18:00 - 21:00)</SelectItem>
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Instructions */}
            <div className="space-y-2">
              <Label htmlFor="deliveryInstructions" className="flex items-center gap-2">
                <Truck className="h-4 w-4" aria-hidden="true" />
                Instruções de Entrega (opcional)
              </Label>
              <Textarea
                id="deliveryInstructions"
                placeholder='Ex: "Entregar nos fundos", "Ligar antes de chegar", "Portão sempre fechado"...'
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                className="resize-none"
                rows={2}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Informações específicas para o entregador sobre localização e acesso
              </p>
            </div>

            {/* Overall Order Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="orderNotes" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Observações do Pedido (opcional)
                </Label>
                <span className="text-xs text-muted-foreground">
                  {orderNotes.length}/{MAX_ORDER_NOTES_LENGTH}
                </span>
              </div>
              <Textarea
                id="orderNotes"
                placeholder='Ex: "Entregar nos fundos", "Ligar antes da entrega", "Pedido urgente"...'
                value={orderNotes}
                onChange={(e) => handleOrderNotesChange(e.target.value)}
                onBlur={(e) => handleOrderNotesBlur(e.target.value)}
                className="resize-none"
                rows={3}
                maxLength={MAX_ORDER_NOTES_LENGTH}
              />
            </div>
          </div>

          {/* Order summary - sticky on mobile */}
          <div className="bg-card rounded-lg shadow-sm p-6 sticky bottom-20 md:bottom-4">
            {isSyncing && (
              <div className="flex items-center gap-2 text-sm text-amber-600 mb-4">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Sincronizando alterações...
              </div>
            )}

            <div className="flex justify-between items-center mb-6">
              <span className="text-lg md:text-xl font-semibold">Subtotal:</span>
              <span className="text-2xl md:text-3xl font-bold text-primary">
                R$ {(subtotal / 100).toFixed(2)}
              </span>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || isSyncing || items.length === 0}
              className="w-full h-12"
              size="lg"
            >
              {submitting ? "Enviando..." : "Enviar Pedido"}
            </Button>

            <p className="mt-3 text-xs text-center text-muted-foreground">
              Itens por peso serão precificados após pesagem
            </p>
          </div>
        </>
      )}

      {/* Clear cart confirmation */}
      <AlertDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Limpar carrinho?"
        description={`Isso removerá todos os ${items.length} itens do seu carrinho. Esta ação não pode ser desfeita.`}
        confirmText="Limpar Carrinho"
        cancelText="Cancelar"
        confirmVariant="destructive"
        onConfirm={handleClearCart}
      />

      {/* Remove item confirmation */}
      <AlertDialog
        open={!!itemToRemove}
        onOpenChange={(open) => !open && setItemToRemove(null)}
        title="Remover item?"
        description={itemToRemove ? `Tem certeza que deseja remover "${itemToRemove.name}" do carrinho?` : ""}
        confirmText="Remover"
        cancelText="Cancelar"
        confirmVariant="destructive"
        onConfirm={() => {
          if (itemToRemove) {
            handleRemoveItem(itemToRemove.id);
          }
        }}
      />
    </PageLayout>
  );
}
