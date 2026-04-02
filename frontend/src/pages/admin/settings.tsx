import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Calendar,
  Clock,
  Package,
  Plus,
  X,
} from "lucide-react";

const WEEKDAYS = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

export function TenantSettingsPage() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.tenantSettings.get.useQuery();

  // State
  const [minDeliveryDaysAhead, setMinDeliveryDaysAhead] = useState(1);
  const [maxDeliveryDaysAhead, setMaxDeliveryDaysAhead] = useState(30);
  const [deliveryDaysAllowed, setDeliveryDaysAllowed] = useState<number[]>([1, 2, 3, 4, 5]);
  const [operatingDays, setOperatingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [allowSameDayOrders, setAllowSameDayOrders] = useState(false);
  const [autoConfirmOrders, setAutoConfirmOrders] = useState(false);
  const [deliveryTimeSlots, setDeliveryTimeSlots] = useState<Record<string, string[]>>({});
  const [newTimeSlot, setNewTimeSlot] = useState("");
  const [selectedDayForSlot, setSelectedDayForSlot] = useState<number | null>(null);

  // Initialize state when data loads
  useEffect(() => {
    if (settingsQuery.data) {
      const data = settingsQuery.data;
      setMinDeliveryDaysAhead(data.minDeliveryDaysAhead);
      setMaxDeliveryDaysAhead(data.maxDeliveryDaysAhead);
      setDeliveryDaysAllowed(data.deliveryDaysAllowed as number[]);
      setOperatingDays(data.operatingDays as number[]);
      setAllowSameDayOrders(data.allowSameDayOrders);
      setAutoConfirmOrders(data.autoConfirmOrders);
      if (data.deliveryTimeSlots) {
        setDeliveryTimeSlots(data.deliveryTimeSlots as Record<string, string[]>);
      }
    }
  }, [settingsQuery.data]);

  const updateSettingsMutation = trpc.tenantSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso");
      void utils.tenantSettings.get.invalidate();
      void utils.tenantSettings.getAvailableDeliveryDates.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações", {
        description: error.message,
      });
    },
  });

  const handleSave = () => {
    // Validation
    if (minDeliveryDaysAhead < 0 || minDeliveryDaysAhead > 30) {
      toast.error("Prazo mínimo deve estar entre 0 e 30 dias");
      return;
    }

    if (maxDeliveryDaysAhead < 1 || maxDeliveryDaysAhead > 365) {
      toast.error("Prazo máximo deve estar entre 1 e 365 dias");
      return;
    }

    if (minDeliveryDaysAhead > maxDeliveryDaysAhead) {
      toast.error("Prazo mínimo não pode ser maior que o prazo máximo");
      return;
    }

    if (deliveryDaysAllowed.length === 0) {
      toast.error("Selecione pelo menos um dia da semana para entregas");
      return;
    }

    if (operatingDays.length === 0) {
      toast.error("Selecione pelo menos um dia de operação");
      return;
    }

    updateSettingsMutation.mutate({
      minDeliveryDaysAhead,
      maxDeliveryDaysAhead,
      deliveryDaysAllowed,
      operatingDays,
      allowSameDayOrders,
      autoConfirmOrders,
      deliveryTimeSlots: Object.keys(deliveryTimeSlots).length > 0 ? deliveryTimeSlots : undefined,
    });
  };

  const toggleDeliveryDay = (day: number) => {
    setDeliveryDaysAllowed((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const toggleOperatingDay = (day: number) => {
    setOperatingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const addTimeSlot = (day: number) => {
    if (!newTimeSlot.trim()) {
      toast.error("Digite um horário válido");
      return;
    }

    // Simple validation for time format (HH:MM-HH:MM)
    const timePattern = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
    if (!timePattern.test(newTimeSlot)) {
      toast.error("Formato inválido. Use HH:MM-HH:MM (ex: 08:00-12:00)");
      return;
    }

    const dayKey = day.toString();
    setDeliveryTimeSlots((prev) => ({
      ...prev,
      [dayKey]: [...(prev[dayKey] || []), newTimeSlot],
    }));
    setNewTimeSlot("");
    setSelectedDayForSlot(null);
  };

  const removeTimeSlot = (day: number, slotIndex: number) => {
    const dayKey = day.toString();
    setDeliveryTimeSlots((prev) => {
      const updated = { ...prev };
      updated[dayKey] = updated[dayKey].filter((_, i) => i !== slotIndex);
      if (updated[dayKey].length === 0) {
        delete updated[dayKey];
      }
      return updated;
    });
  };

  if (settingsQuery.isLoading) {
    return (
      <PageLayout title="Configurações">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Configurações do Tenant">
      <div className="space-y-6">
        {/* Delivery Schedule Settings */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Calendar className="h-5 w-5 inline mr-2" />
              Agendamento de Entregas
            </CardTitle>
            <CardDescription>
              Configure os prazos e dias permitidos para entregas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Min/Max Days */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minDays">Prazo Mínimo (dias)</Label>
                <Input
                  id="minDays"
                  type="number"
                  min="0"
                  max="30"
                  value={minDeliveryDaysAhead}
                  onChange={(e) => setMinDeliveryDaysAhead(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500">
                  Mínimo de dias de antecedência para agendar entrega
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDays">Prazo Máximo (dias)</Label>
                <Input
                  id="maxDays"
                  type="number"
                  min="1"
                  max="365"
                  value={maxDeliveryDaysAhead}
                  onChange={(e) => setMaxDeliveryDaysAhead(parseInt(e.target.value) || 30)}
                />
                <p className="text-xs text-gray-500">
                  Máximo de dias no futuro para agendar entrega
                </p>
              </div>
            </div>

            {/* Delivery Days Allowed */}
            <div className="space-y-3">
              <Label>Dias da Semana para Entregas</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day.value}
                    className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                      deliveryDaysAllowed.includes(day.value)
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => toggleDeliveryDay(day.value)}
                  >
                    <Checkbox
                      id={`delivery-${day.value}`}
                      checked={deliveryDaysAllowed.includes(day.value)}
                      onCheckedChange={() => toggleDeliveryDay(day.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Label
                      htmlFor={`delivery-${day.value}`}
                      className="cursor-pointer text-sm font-medium"
                    >
                      {day.short}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Selecione os dias em que você realiza entregas
              </p>
            </div>

            {/* Same Day Orders */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="same-day" className="cursor-pointer">
                  Permitir Entregas no Mesmo Dia
                </Label>
                <p className="text-sm text-gray-500">
                  Clientes podem solicitar entrega para o mesmo dia
                </p>
              </div>
              <Switch
                id="same-day"
                checked={allowSameDayOrders}
                onCheckedChange={setAllowSameDayOrders}
              />
            </div>
          </CardContent>
        </Card>

        {/* Time Slots */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Clock className="h-5 w-5 inline mr-2" />
              Horários de Entrega
            </CardTitle>
            <CardDescription>
              Configure horários específicos por dia da semana (opcional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {WEEKDAYS.map((day) => {
              const dayKey = day.value.toString();
              const slots = deliveryTimeSlots[dayKey] || [];
              const isDeliveryDay = deliveryDaysAllowed.includes(day.value);

              if (!isDeliveryDay) return null;

              return (
                <div key={day.value} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{day.label}</Label>
                    {selectedDayForSlot !== day.value && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDayForSlot(day.value)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Horário
                      </Button>
                    )}
                  </div>

                  {/* Existing time slots */}
                  {slots.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-sm"
                        >
                          <Clock className="h-3 w-3" />
                          {slot}
                          <button
                            onClick={() => removeTimeSlot(day.value, index)}
                            className="hover:text-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new time slot */}
                  {selectedDayForSlot === day.value && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="08:00-12:00"
                        value={newTimeSlot}
                        onChange={(e) => setNewTimeSlot(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button onClick={() => addTimeSlot(day.value)} size="sm">
                        Adicionar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDayForSlot(null);
                          setNewTimeSlot("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}

                  {slots.length === 0 && selectedDayForSlot !== day.value && (
                    <p className="text-sm text-gray-500">
                      Nenhum horário específico configurado (horários padrão serão usados)
                    </p>
                  )}
                </div>
              );
            })}

            {deliveryDaysAllowed.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Selecione os dias de entrega acima para configurar horários
              </p>
            )}
          </CardContent>
        </Card>

        {/* Operating Days */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Package className="h-5 w-5 inline mr-2" />
              Dias de Operação
            </CardTitle>
            <CardDescription>
              Dias em que sua empresa aceita novos pedidos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day.value}
                  className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    operatingDays.includes(day.value)
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => toggleOperatingDay(day.value)}
                >
                  <Checkbox
                    id={`operating-${day.value}`}
                    checked={operatingDays.includes(day.value)}
                    onCheckedChange={() => toggleOperatingDay(day.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Label
                    htmlFor={`operating-${day.value}`}
                    className="cursor-pointer text-sm font-medium"
                  >
                    {day.short}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Settings */}
        <Card>
          <CardHeader>
            <CardTitle>
              <SettingsIcon className="h-5 w-5 inline mr-2" />
              Configurações de Pedidos
            </CardTitle>
            <CardDescription>
              Opções de processamento de pedidos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="auto-confirm" className="cursor-pointer">
                  Auto-confirmar Pedidos
                </Label>
                <p className="text-sm text-gray-500">
                  Pedidos são automaticamente confirmados sem revisão manual
                </p>
              </div>
              <Switch
                id="auto-confirm"
                checked={autoConfirmOrders}
                onCheckedChange={setAutoConfirmOrders}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            size="lg"
          >
            {updateSettingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
