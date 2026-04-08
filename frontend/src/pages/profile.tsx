import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import {
  User,
  Building2,
  Settings,
  Save,
  Loader2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Sun,
  Moon,
  Monitor,
  Bell,
} from "lucide-react";

interface AddressJson {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export function ProfilePage() {
  const utils = trpc.useUtils();
  const profileQuery = trpc.userProfile.get.useQuery();
  const preferencesQuery = trpc.userProfile.getPreferences.useQuery();
  const { theme: globalTheme, setTheme: setGlobalTheme } = useTheme();

  // Personal info state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Tenant info state (for tenant admins)
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [useSameAddress, setUseSameAddress] = useState(true);

  // Preferences state (synced with global theme)
  const [localTheme, setLocalTheme] = useState<"light" | "dark" | "system">(globalTheme);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [notifyOrderStatus, setNotifyOrderStatus] = useState(true);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [notifyNewOrders, setNotifyNewOrders] = useState(true);

  // Sync local theme with global theme when changed
  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setLocalTheme(newTheme);
    setGlobalTheme(newTheme);
  };

  // Initialize state when data loads
  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name || "");
      setPhone(profileQuery.data.phone || "");
      setContactEmail(profileQuery.data.contactEmail || "");

      // Load tenant data if user is tenant admin
      const tenantMembership = profileQuery.data.memberships.find(
        (m) => m.role.name === "TENANT_OWNER" || m.role.name === "TENANT_ADMIN"
      );

      if (tenantMembership?.tenant) {
        const tenant = tenantMembership.tenant;
        setCnpj(tenant.cnpj || "");
        setRazaoSocial(tenant.razaoSocial || "");
        setTenantPhone(tenant.phone || "");

        if (tenant.address) {
          const addr = tenant.address as AddressJson;
          setAddress({
            street: addr.street || "",
            number: addr.number || "",
            complement: addr.complement || "",
            neighborhood: addr.neighborhood || "",
            city: addr.city || "",
            state: addr.state || "",
            zipCode: addr.zipCode || "",
          });
        }

        if (tenant.deliveryAddress) {
          const delAddr = tenant.deliveryAddress as AddressJson;
          setDeliveryAddress({
            street: delAddr.street || "",
            number: delAddr.number || "",
            complement: delAddr.complement || "",
            neighborhood: delAddr.neighborhood || "",
            city: delAddr.city || "",
            state: delAddr.state || "",
            zipCode: delAddr.zipCode || "",
          });
          setUseSameAddress(false);
        }
      }
    }

    if (preferencesQuery.data) {
      const savedTheme = preferencesQuery.data.theme as "light" | "dark" | "system";
      setLocalTheme(savedTheme);
      setGlobalTheme(savedTheme);
      setDensity(preferencesQuery.data.density as "comfortable" | "compact");
      setNotifyOrderStatus(preferencesQuery.data.notifyOrderStatus);
      setNotifyLowStock(preferencesQuery.data.notifyLowStock);
      setNotifyNewOrders(preferencesQuery.data.notifyNewOrders);
    }
  }, [profileQuery.data, preferencesQuery.data, setGlobalTheme]);

  const updateProfileMutation = trpc.userProfile.update.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso");
      void utils.userProfile.get.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar perfil", {
        description: error.message,
      });
    },
  });

  const updateTenantMutation = trpc.userProfile.updateTenantProfile.useMutation({
    onSuccess: () => {
      toast.success("Dados da empresa atualizados com sucesso");
      void utils.userProfile.get.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar dados da empresa", {
        description: error.message,
      });
    },
  });

  const updatePreferencesMutation = trpc.userProfile.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Preferências atualizadas com sucesso");
      void utils.userProfile.getPreferences.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar preferências", {
        description: error.message,
      });
    },
  });

  const handleSavePersonalInfo = () => {
    updateProfileMutation.mutate({
      name: name || undefined,
      phone: phone || null,
      contactEmail: contactEmail || null,
    });
  };

  const handleSaveTenantInfo = () => {
    const tenantMembership = profileQuery.data?.memberships.find(
      (m) => m.role.name === "TENANT_OWNER" || m.role.name === "TENANT_ADMIN"
    );

    if (!tenantMembership?.tenant) {
      toast.error("Você não tem permissão para atualizar dados da empresa");
      return;
    }

    updateTenantMutation.mutate({
      tenantId: tenantMembership.tenant.id,
      cnpj: cnpj || null,
      razaoSocial: razaoSocial || null,
      phone: tenantPhone || null,
      address: address.street ? address : null,
      deliveryAddress: !useSameAddress && deliveryAddress.street ? deliveryAddress : null,
    });
  };

  const handleSavePreferences = () => {
    updatePreferencesMutation.mutate({
      theme: localTheme,
      density,
      notifyOrderStatus,
      notifyLowStock,
      notifyNewOrders,
    });
  };

  const isTenantAdmin = profileQuery.data?.memberships.some(
    (m) => m.role.name === "TENANT_OWNER" || m.role.name === "TENANT_ADMIN"
  );

  if (profileQuery.isLoading || preferencesQuery.isLoading) {
    return (
      <PageLayout title="Meu Perfil">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Meu Perfil">
      <div className="max-w-5xl mx-auto">
        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="personal" className="flex items-center gap-2 py-3">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Informações</span>
              <span className="sm:hidden">Pessoal</span>
            </TabsTrigger>
            {isTenantAdmin && (
              <TabsTrigger value="company" className="flex items-center gap-2 py-3">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Empresa</span>
                <span className="sm:hidden">Empresa</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="preferences" className="flex items-center gap-2 py-3">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Preferências</span>
              <span className="sm:hidden">Config.</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-primary rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-primary-foreground">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Gerencie seus dados pessoais e informações de contato
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold">
                      Nome Completo *
                    </Label>
                    <Input
                      id="name"
                      placeholder="Seu nome completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold">
                      Email de Login
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-600" />
                      <Input
                        id="email"
                        type="email"
                        value={profileQuery.data?.email || ""}
                        disabled
                        className="pl-10 h-11 bg-gray-50 dark:bg-gray-900 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Email de autenticação não pode ser alterado
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold">
                      Telefone
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-600" />
                      <Input
                        id="phone"
                        placeholder="(11) 98765-4321"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail" className="text-sm font-semibold">
                      Email de Contato Alternativo
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-600" />
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="contato@exemplo.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="pl-10 h-11"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Email alternativo para comunicações (opcional)
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSavePersonalInfo}
                    disabled={updateProfileMutation.isPending}
                    size="lg"
                    className="min-w-[200px]"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Information Tab (Tenant Admins Only) */}
          {isTenantAdmin && (
            <TabsContent value="company" className="space-y-4">
              <Card>
                <CardHeader className="border-b bg-primary rounded-t-xl">
                  <CardTitle className="flex items-center gap-2 text-primary-foreground">
                    <Building2 className="h-5 w-5" />
                    Dados da Empresa
                  </CardTitle>
                  <CardDescription className="text-primary-foreground/80">
                    Informações cadastrais e fiscais da sua empresa
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="razaoSocial" className="text-sm font-semibold">
                        Razão Social
                      </Label>
                      <Input
                        id="razaoSocial"
                        placeholder="Nome empresarial completo"
                        value={razaoSocial}
                        onChange={(e) => setRazaoSocial(e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cnpj" className="text-sm font-semibold">
                        CNPJ
                      </Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-600" />
                        <Input
                          id="cnpj"
                          placeholder="00.000.000/0000-00"
                          value={cnpj}
                          onChange={(e) => setCnpj(e.target.value.replace(/\D/g, ""))}
                          maxLength={18}
                          className="pl-10 h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="tenantPhone" className="text-sm font-semibold">
                        Telefone Comercial
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-600" />
                        <Input
                          id="tenantPhone"
                          placeholder="(11) 3000-0000"
                          value={tenantPhone}
                          onChange={(e) => setTenantPhone(e.target.value)}
                          className="pl-10 h-11"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Endereço Principal
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-6">
                    <div className="space-y-2 md:col-span-3">
                      <Label htmlFor="street">Rua/Avenida</Label>
                      <Input
                        id="street"
                        placeholder="Nome da rua"
                        value={address.street}
                        onChange={(e) =>
                          setAddress({ ...address, street: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="number">Número</Label>
                      <Input
                        id="number"
                        placeholder="123"
                        value={address.number}
                        onChange={(e) =>
                          setAddress({ ...address, number: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="complement">Complemento</Label>
                      <Input
                        id="complement"
                        placeholder="Apto 45"
                        value={address.complement}
                        onChange={(e) =>
                          setAddress({ ...address, complement: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        placeholder="Nome do bairro"
                        value={address.neighborhood}
                        onChange={(e) =>
                          setAddress({ ...address, neighborhood: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        placeholder="São Paulo"
                        value={address.city}
                        onChange={(e) =>
                          setAddress({ ...address, city: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">UF</Label>
                      <Input
                        id="state"
                        placeholder="SP"
                        maxLength={2}
                        value={address.state}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            state: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zipCode">CEP</Label>
                      <Input
                        id="zipCode"
                        placeholder="00000000"
                        value={address.zipCode}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            zipCode: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        maxLength={8}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-4 bg-secondary rounded-lg border border-border">
                    <Switch
                      id="same-address"
                      checked={useSameAddress}
                      onCheckedChange={setUseSameAddress}
                    />
                    <Label htmlFor="same-address" className="cursor-pointer font-medium">
                      Usar o mesmo endereço para entregas
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {!useSameAddress && (
                <Card>
                  <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Endereço de Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid gap-4 md:grid-cols-6">
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="del-street">Rua/Avenida</Label>
                        <Input
                          id="del-street"
                          placeholder="Nome da rua"
                          value={deliveryAddress.street}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              street: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="del-number">Número</Label>
                        <Input
                          id="del-number"
                          placeholder="123"
                          value={deliveryAddress.number}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              number: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="del-complement">Complemento</Label>
                        <Input
                          id="del-complement"
                          placeholder="Galpão 2"
                          value={deliveryAddress.complement}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              complement: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="del-neighborhood">Bairro</Label>
                        <Input
                          id="del-neighborhood"
                          placeholder="Nome do bairro"
                          value={deliveryAddress.neighborhood}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              neighborhood: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="del-city">Cidade</Label>
                        <Input
                          id="del-city"
                          placeholder="São Paulo"
                          value={deliveryAddress.city}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              city: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="del-state">UF</Label>
                        <Input
                          id="del-state"
                          placeholder="SP"
                          maxLength={2}
                          value={deliveryAddress.state}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              state: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="del-zipCode">CEP</Label>
                        <Input
                          id="del-zipCode"
                          placeholder="00000000"
                          value={deliveryAddress.zipCode}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              zipCode: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          maxLength={8}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveTenantInfo}
                  disabled={updateTenantMutation.isPending}
                  size="lg"
                  className="min-w-[200px]"
                >
                  {updateTenantMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Dados da Empresa
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          )}

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-primary rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-primary-foreground">
                  <Settings className="h-5 w-5" />
                  Preferências do Sistema
                </CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Personalize a aparência e o comportamento do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                {/* Theme Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Tema da Interface</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleThemeChange("light")}
                      className={`p-4 rounded-lg border-2 transition-all ${localTheme === "light"
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50 hover:shadow-sm hover:bg-accent/10"
                        }`}
                    >
                      <Sun className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
                      <p className="text-sm font-medium">Claro</p>
                    </button>
                    <button
                      onClick={() => handleThemeChange("dark")}
                      className={`p-4 rounded-lg border-2 transition-all ${localTheme === "dark"
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50 hover:shadow-sm hover:bg-accent/10"
                        }`}
                    >
                      <Moon className="h-6 w-6 mx-auto mb-2 text-indigo-600" />
                      <p className="text-sm font-medium">Escuro</p>
                    </button>
                    <button
                      onClick={() => handleThemeChange("system")}
                      className={`p-4 rounded-lg border-2 transition-all ${localTheme === "system"
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50 hover:shadow-sm hover:bg-accent/10"
                        }`}
                    >
                      <Monitor className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Sistema</p>
                    </button>
                  </div>
                </div>

                {/* Density Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Densidade da Interface</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setDensity("comfortable")}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${density === "comfortable"
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50 hover:shadow-sm hover:bg-accent/10"
                        }`}
                    >
                      <p className="font-medium mb-1">Confortável</p>
                      <p className="text-xs text-muted-foreground">Mais espaçamento e elementos maiores</p>
                    </button>
                    <button
                      onClick={() => setDensity("compact")}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${density === "compact"
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50 hover:shadow-sm hover:bg-accent/10"
                        }`}
                    >
                      <p className="font-medium mb-1">Compacta</p>
                      <p className="text-xs text-muted-foreground">Menos espaço, mais conteúdo visível</p>
                    </button>
                  </div>
                </div>

                {/* Notifications */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notificações no Sistema
                  </Label>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-card-foreground">Atualizações de Pedidos</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Notificações quando pedidos mudarem de status
                        </p>
                      </div>
                      <Switch
                        id="notify-orders"
                        checked={notifyOrderStatus}
                        onCheckedChange={setNotifyOrderStatus}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-card-foreground">Estoque Baixo</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Alertas quando produtos estiverem com estoque baixo
                        </p>
                      </div>
                      <Switch
                        id="notify-stock"
                        checked={notifyLowStock}
                        onCheckedChange={setNotifyLowStock}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-card-foreground">Novos Pedidos</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Notificação quando novos pedidos forem recebidos
                        </p>
                      </div>
                      <Switch
                        id="notify-new-orders"
                        checked={notifyNewOrders}
                        onCheckedChange={setNotifyNewOrders}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={updatePreferencesMutation.isPending}
                    size="lg"
                    className="min-w-[200px]"
                  >
                    {updatePreferencesMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Preferências
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
