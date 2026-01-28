import { Check, Clock, Package, Truck } from "lucide-react";

interface OrderStatusTimelineProps {
  status: "DRAFT" | "SENT" | "IN_SEPARATION" | "FINALIZED";
  compact?: boolean;
}

const statusSteps = [
  { key: "SENT", label: "Enviado", icon: Clock },
  { key: "IN_SEPARATION", label: "Em Separação", icon: Package },
  { key: "FINALIZED", label: "Finalizado", icon: Truck },
];

export function OrderStatusTimeline({ status, compact = false }: OrderStatusTimelineProps) {
  const currentStepIndex = statusSteps.findIndex((step) => step.key === status);

  // If DRAFT, show special message
  if (status === "DRAFT") {
    return (
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <p className="text-sm text-gray-600 text-center">Rascunho - Ainda não enviado</p>
      </div>
    );
  }

  return (
    <div className={`${compact ? "py-2" : "py-4"}`}>
      {/* Timeline */}
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-green-500 transition-all duration-500 -z-0"
          style={{
            width:
              currentStepIndex === -1
                ? "0%"
                : currentStepIndex === 0
                ? "0%"
                : currentStepIndex === 1
                ? "50%"
                : "100%",
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {statusSteps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center flex-1">
                {/* Circle/Icon */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 z-10 border-2
                    ${
                      isCompleted
                        ? "bg-green-500 border-green-500 text-white"
                        : isCurrent
                        ? "bg-blue-500 border-blue-500 text-white animate-pulse"
                        : "bg-white border-gray-300 text-gray-400"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                {/* Label */}
                {!compact && (
                  <div className="mt-2 text-center">
                    <p
                      className={`text-xs font-medium ${
                        isCompleted || isCurrent
                          ? "text-gray-900"
                          : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-blue-600 mt-1 font-semibold">
                        Atual
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact labels below */}
      {compact && (
        <div className="flex justify-between mt-2 px-1">
          {statusSteps.map((step, index) => {
            const isCurrent = index === currentStepIndex;
            return (
              <p
                key={step.key}
                className={`text-xs text-center flex-1 ${
                  isCurrent ? "font-semibold text-blue-600" : "text-gray-500"
                }`}
              >
                {step.label}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
