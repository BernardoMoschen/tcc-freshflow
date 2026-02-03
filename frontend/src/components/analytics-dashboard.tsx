import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Minus
} from "lucide-react";

export function AnalyticsDashboard() {
  const analyticsQuery = trpc.analytics.dashboard.useQuery({});

  if (analyticsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (analyticsQuery.isError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Falha ao carregar analytics</p>
        <p className="text-sm text-red-600 mt-1">{analyticsQuery.error.message}</p>
      </div>
    );
  }

  const data = analyticsQuery.data!;

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatPercent = (value: number) => {
    const formatted = Math.abs(value).toFixed(1);
    return `${formatted}%`;
  };

  const ChangeIndicator = ({ value }: { value: number }) => {
    if (value > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium">+{formatPercent(value)}</span>
        </div>
      );
    } else if (value < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown className="h-4 w-4" />
          <span className="text-xs font-medium">{formatPercent(value)}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-gray-500">
        <Minus className="h-4 w-4" />
        <span className="text-xs font-medium">0%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(data.overview.revenue.current)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">vs período anterior</p>
              <ChangeIndicator value={data.overview.revenue.change} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.orders.current}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">vs período anterior</p>
              <ChangeIndicator value={data.overview.orders.change} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(data.overview.avgOrderValue.current)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">vs período anterior</p>
              <ChangeIndicator value={data.overview.avgOrderValue.change} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Receita - Últimos 30 Dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <SimpleLineChart data={data.revenueTimeSeries} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum produto vendido ainda</p>
            ) : (
              <div className="space-y-3">
                {data.topProducts.slice(0, 5).map((product, index) => (
                  <div key={product.optionId} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.productName}</p>
                      <p className="text-xs text-gray-500 truncate">{product.optionName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatPrice(product.revenue)}</p>
                      <p className="text-xs text-gray-500">
                        {product.revenuePercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topCustomers.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum cliente ainda</p>
            ) : (
              <div className="space-y-3">
                {data.topCustomers.slice(0, 5).map((customer, index) => (
                  <div key={customer.customerId} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{customer.accountName}</p>
                      <p className="text-xs text-gray-500">
                        {customer.orderCount} pedidos • Média {formatPrice(customer.avgOrderValue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatPrice(customer.revenue)}</p>
                      <p className="text-xs text-gray-500">
                        {customer.revenuePercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status dos Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {data.statusBreakdown.map((status) => (
              <div key={status.status} className="flex items-center gap-2">
                <Badge variant={
                  status.status === "FINALIZED" ? "secondary" :
                  status.status === "SENT" ? "default" :
                  "outline"
                }>
                  {translateStatus(status.status)}
                </Badge>
                <span className="text-sm font-medium">{status.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Simple SVG line chart component
function SimpleLineChart({ data }: { data: Array<{ date: string; revenue: number; orders: number }> }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Nenhum dado disponível
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue));
  const minRevenue = Math.min(...data.map((d) => d.revenue));
  const padding = 40;
  const width = 800;
  const height = 256;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((d.revenue - minRevenue) / (maxRevenue - minRevenue || 1)) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding + chartHeight * (1 - ratio);
        const value = minRevenue + (maxRevenue - minRevenue) * ratio;
        return (
          <g key={ratio}>
            <line
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text
              x={padding - 10}
              y={y + 4}
              textAnchor="end"
              className="text-xs fill-gray-500"
            >
              {formatPrice(value)}
            </text>
          </g>
        );
      })}

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Area fill */}
      <polygon
        points={`${padding},${padding + chartHeight} ${points} ${width - padding},${padding + chartHeight}`}
        fill="#16a34a"
        fillOpacity="0.1"
      />

      {/* Points */}
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((d.revenue - minRevenue) / (maxRevenue - minRevenue || 1)) * chartHeight;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill="#16a34a"
            className="hover:r-5 transition-all cursor-pointer"
          >
            <title>
              {new Date(d.date).toLocaleDateString("pt-BR")}
              {"\n"}
              {formatPrice(d.revenue)}
              {"\n"}
              {d.orders} pedidos
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

function translateStatus(status: string) {
  const statusMap: Record<string, string> = {
    DRAFT: "Rascunho",
    SENT: "Enviado",
    IN_SEPARATION: "Em Separação",
    FINALIZED: "Finalizado",
  };
  return statusMap[status] || status;
}
