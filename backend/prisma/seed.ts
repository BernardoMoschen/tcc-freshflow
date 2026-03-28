import {
  PrismaClient,
  RoleType,
  UnitType,
  OrderStatus,
  StockMovementType,
  OrderActivityType,
} from "@prisma/client";

const prisma = new PrismaClient();

// Helper: date relative to now
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // =============================================
  // LIMPEZA
  // =============================================
  await prisma.orderActivity.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.weighing.deleteMany();
  await prisma.deliveryNote.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customerPrice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.productOption.deleteMany();
  await prisma.product.deleteMany();
  await prisma.tenantSettings.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.account.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  console.log("✨ Dados existentes removidos\n");

  // =============================================
  // ROLES
  // =============================================
  const [platformAdmin, tenantOwner, tenantAdmin, accountOwner, accountBuyer] = await Promise.all([
    prisma.role.create({ data: { name: RoleType.PLATFORM_ADMIN } }),
    prisma.role.create({ data: { name: RoleType.TENANT_OWNER } }),
    prisma.role.create({ data: { name: RoleType.TENANT_ADMIN } }),
    prisma.role.create({ data: { name: RoleType.ACCOUNT_OWNER } }),
    prisma.role.create({ data: { name: RoleType.ACCOUNT_BUYER } }),
  ]);
  console.log("✅ 5 roles criadas");

  // =============================================
  // USERS
  // =============================================
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@freshflow.com",
      supabaseId: "00000000-0000-0000-0000-000000000001",
      name: "Admin Sistema",
      phone: "(11) 99999-0001",
    },
  });

  const carlosUser = await prisma.user.create({
    data: {
      email: "carlos@verdecampo.com.br",
      supabaseId: "00000000-0000-0000-0000-000000000002",
      name: "Carlos Silva",
      phone: "(11) 98765-4321",
      contactEmail: "carlos.silva@gmail.com",
    },
  });

  const anaUser = await prisma.user.create({
    data: {
      email: "ana@verdecampo.com.br",
      supabaseId: "00000000-0000-0000-0000-000000000003",
      name: "Ana Oliveira",
      phone: "(11) 98765-4322",
    },
  });

  const robertoUser = await prisma.user.create({
    data: {
      email: "roberto@sabordaterra.com.br",
      supabaseId: "00000000-0000-0000-0000-000000000004",
      name: "Roberto Santos",
      phone: "(11) 97654-3210",
      contactEmail: "roberto.santos@hotmail.com",
    },
  });

  const mariaUser = await prisma.user.create({
    data: {
      email: "maria@cantinadonamaria.com.br",
      supabaseId: "00000000-0000-0000-0000-000000000005",
      name: "Maria Costa",
      phone: "(11) 96543-2109",
    },
  });

  const pedroUser = await prisma.user.create({
    data: {
      email: "pedro@bistrojardim.com.br",
      supabaseId: "00000000-0000-0000-0000-000000000006",
      name: "Pedro Almeida",
      phone: "(11) 95432-1098",
      contactEmail: "pedro.almeida@outlook.com",
    },
  });

  const julianaUser = await prisma.user.create({
    data: {
      email: "juliana@sabordaterra.com.br",
      supabaseId: "00000000-0000-0000-0000-000000000007",
      name: "Juliana Lima",
      phone: "(11) 94321-0987",
    },
  });

  const freshcoOwner = await prisma.user.create({
    data: {
      email: "owner@freshco.com",
      supabaseId: "00000000-0000-0000-0000-000000000008",
      name: "Fernanda Rocha",
      phone: "(11) 93210-4567",
      contactEmail: "fernanda.rocha@freshco.com",
    },
  });

  const chefUser = await prisma.user.create({
    data: {
      email: "chef@chefstable.com",
      supabaseId: "00000000-0000-0000-0000-000000000009",
      name: "Rafael Moreira",
      phone: "(11) 92123-9876",
      contactEmail: "rafael@chefstable.com",
    },
  });

  console.log("✅ 9 usuários criados");

  // =============================================
  // TENANT (Distribuidora)
  // =============================================
  const tenant = await prisma.tenant.create({
    data: {
      name: "Verde Campo Distribuidora",
      slug: "verde-campo",
      cnpj: "12345678000190",
      razaoSocial: "Verde Campo Distribuidora de Alimentos LTDA",
      phone: "(11) 3456-7890",
      address: {
        street: "Rua dos Alimentos",
        number: "500",
        complement: "Galpão 3",
        neighborhood: "Vila Leopoldina",
        city: "São Paulo",
        state: "SP",
        zipCode: "05311000",
      },
      deliveryAddress: {
        street: "Rua Augusta",
        number: "1200",
        complement: "",
        neighborhood: "Consolação",
        city: "São Paulo",
        state: "SP",
        zipCode: "01304001",
      },
    },
  });
  console.log("✅ Tenant criado: Verde Campo Distribuidora");

  const freshcoTenant = await prisma.tenant.create({
    data: {
      name: "FreshCo Distribuidora",
      slug: "freshco",
      cnpj: "45678912000155",
      razaoSocial: "FreshCo Distribuidora de Alimentos LTDA",
      phone: "(11) 3333-2211",
      address: {
        street: "Av. dos Produtores",
        number: "820",
        complement: "Bloco B",
        neighborhood: "Butanta",
        city: "Sao Paulo",
        state: "SP",
        zipCode: "05502000",
      },
      deliveryAddress: {
        street: "Rua das Flores",
        number: "150",
        complement: "",
        neighborhood: "Pinheiros",
        city: "Sao Paulo",
        state: "SP",
        zipCode: "05422010",
      },
    },
  });
  console.log("✅ Tenant criado: FreshCo Distribuidora");

  // =============================================
  // MEMBERSHIPS (Tenant-level)
  // =============================================
  await prisma.membership.create({
    data: { userId: adminUser.id, roleId: platformAdmin.id },
  });
  await prisma.membership.create({
    data: {
      userId: carlosUser.id,
      roleId: tenantOwner.id,
      tenantId: tenant.id,
    },
  });
  await prisma.membership.create({
    data: {
      userId: anaUser.id,
      roleId: tenantAdmin.id,
      tenantId: tenant.id,
    },
  });
  await prisma.membership.create({
    data: {
      userId: freshcoOwner.id,
      roleId: tenantOwner.id,
      tenantId: freshcoTenant.id,
    },
  });
  console.log("✅ Memberships de tenant criadas");

  // =============================================
  // ACCOUNTS (Restaurantes)
  // =============================================
  const saborDaTerra = await prisma.account.create({
    data: {
      name: "Restaurante Sabor da Terra",
      slug: "sabor-da-terra",
      tenantId: tenant.id,
    },
  });

  const cantinadonaMaria = await prisma.account.create({
    data: {
      name: "Cantina Dona Maria",
      slug: "cantina-dona-maria",
      tenantId: tenant.id,
    },
  });

  const bistroJardim = await prisma.account.create({
    data: {
      name: "Bistrô Jardim",
      slug: "bistro-jardim",
      tenantId: tenant.id,
    },
  });

  const chefsTable = await prisma.account.create({
    data: {
      name: "Chef's Table",
      slug: "chefs-table",
      tenantId: freshcoTenant.id,
    },
  });
  console.log("✅ 4 contas (restaurantes) criadas");

  // =============================================
  // MEMBERSHIPS (Account-level)
  // =============================================
  await prisma.membership.create({
    data: {
      userId: robertoUser.id,
      roleId: accountOwner.id,
      accountId: saborDaTerra.id,
    },
  });
  await prisma.membership.create({
    data: {
      userId: julianaUser.id,
      roleId: accountBuyer.id,
      accountId: saborDaTerra.id,
    },
  });
  await prisma.membership.create({
    data: {
      userId: mariaUser.id,
      roleId: accountOwner.id,
      accountId: cantinadonaMaria.id,
    },
  });
  await prisma.membership.create({
    data: {
      userId: pedroUser.id,
      roleId: accountOwner.id,
      accountId: bistroJardim.id,
    },
  });
  await prisma.membership.create({
    data: {
      userId: chefUser.id,
      roleId: accountOwner.id,
      accountId: chefsTable.id,
    },
  });
  console.log("✅ Memberships de contas criadas");

  // =============================================
  // CUSTOMERS
  // =============================================
  const customerSabor = await prisma.customer.create({
    data: { accountId: saborDaTerra.id },
  });
  const customerCantina = await prisma.customer.create({
    data: { accountId: cantinadonaMaria.id },
  });
  const customerBistro = await prisma.customer.create({
    data: { accountId: bistroJardim.id },
  });
  const customerChefsTable = await prisma.customer.create({
    data: { accountId: chefsTable.id },
  });
  console.log("✅ 4 clientes criados");

  // =============================================
  // PRODUCTS + OPTIONS
  // =============================================

  // --- FRUTAS ---
  const bananaNanica = await prisma.product.create({
    data: {
      name: "Banana Nanica",
      description: "Banana nanica madura, ideal para sobremesas e vitaminas",
      category: "Frutas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Caixa 20kg",
          sku: "BAN-CX20",
          unitType: UnitType.WEIGHT,
          basePrice: 350,
          stockQuantity: 200,
          lowStockThreshold: 40,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const laranjaPera = await prisma.product.create({
    data: {
      name: "Laranja Pêra",
      description: "Laranja pêra suculenta, ótima para sucos naturais",
      category: "Frutas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Saco 10kg",
          sku: "LAR-SC10",
          unitType: UnitType.FIXED,
          basePrice: 2500,
          stockQuantity: 80,
          lowStockThreshold: 15,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const macaFuji = await prisma.product.create({
    data: {
      name: "Maçã Fuji",
      description: "Maçã fuji crocante e doce, importada do Sul",
      category: "Frutas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Caixa 12kg",
          sku: "MAC-CX12",
          unitType: UnitType.WEIGHT,
          basePrice: 890,
          stockQuantity: 120,
          lowStockThreshold: 20,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const mamaoFormosa = await prisma.product.create({
    data: {
      name: "Mamão Formosa",
      description: "Mamão formosa grande, polpa alaranjada e doce",
      category: "Frutas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Unidade",
          sku: "MAM-UN",
          unitType: UnitType.FIXED,
          basePrice: 750,
          stockQuantity: 45,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const morango = await prisma.product.create({
    data: {
      name: "Morango",
      description: "Morango fresco selecionado, bandeja higienizada",
      category: "Frutas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Bandeja 300g",
          sku: "MOR-BD300",
          unitType: UnitType.FIXED,
          basePrice: 800,
          stockQuantity: 60,
          lowStockThreshold: 15,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const limaoTahiti = await prisma.product.create({
    data: {
      name: "Limão Tahiti",
      description: "Limão tahiti verde e suculento",
      category: "Frutas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Saco 5kg",
          sku: "LIM-SC5",
          unitType: UnitType.FIXED,
          basePrice: 1500,
          stockQuantity: 100,
          lowStockThreshold: 20,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const abacaxiPerola = await prisma.product.create({
    data: {
      name: "Abacaxi Pérola",
      description: "Abacaxi pérola doce e aromático",
      category: "Frutas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Unidade",
          sku: "ABA-UN",
          unitType: UnitType.FIXED,
          basePrice: 600,
          stockQuantity: 35,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  // --- HORTALIÇAS ---
  const alfaceCrespa = await prisma.product.create({
    data: {
      name: "Alface Crespa",
      description: "Alface crespa hidropônica, folhas verdes e frescas",
      category: "Hortaliças",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Maço",
          sku: "ALF-MC",
          unitType: UnitType.FIXED,
          basePrice: 250,
          stockQuantity: 80,
          lowStockThreshold: 20,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const rucula = await prisma.product.create({
    data: {
      name: "Rúcula",
      description: "Rúcula fresca e aromática, cultivo hidropônico",
      category: "Hortaliças",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Maço",
          sku: "RUC-MC",
          unitType: UnitType.FIXED,
          basePrice: 350,
          stockQuantity: 50,
          lowStockThreshold: 15,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const couveManteiga = await prisma.product.create({
    data: {
      name: "Couve Manteiga",
      description: "Couve manteiga orgânica, folhas macias",
      category: "Hortaliças",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Maço",
          sku: "COU-MC",
          unitType: UnitType.FIXED,
          basePrice: 300,
          stockQuantity: 60,
          lowStockThreshold: 15,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const espinafre = await prisma.product.create({
    data: {
      name: "Espinafre",
      description: "Espinafre fresco, folhas verdes escuras",
      category: "Hortaliças",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Maço",
          sku: "ESP-MC",
          unitType: UnitType.FIXED,
          basePrice: 450,
          stockQuantity: 8, // Low stock!
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const brocolis = await prisma.product.create({
    data: {
      name: "Brócolis",
      description: "Brócolis ninja fresco, cabeça firme",
      category: "Hortaliças",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Unidade",
          sku: "BRO-UN",
          unitType: UnitType.FIXED,
          basePrice: 600,
          stockQuantity: 30,
          lowStockThreshold: 8,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const tomateItaliano = await prisma.product.create({
    data: {
      name: "Tomate Italiano",
      description: "Tomate italiano para molhos e saladas, firme e saboroso",
      category: "Hortaliças",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Caixa 5kg",
          sku: "TOM-CX5",
          unitType: UnitType.WEIGHT,
          basePrice: 780,
          stockQuantity: 150,
          lowStockThreshold: 30,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const cebolaRoxa = await prisma.product.create({
    data: {
      name: "Cebola Roxa",
      description: "Cebola roxa doce, ideal para saladas e grelhados",
      category: "Hortaliças",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Saco 5kg",
          sku: "CEB-SC5",
          unitType: UnitType.FIXED,
          basePrice: 1800,
          stockQuantity: 70,
          lowStockThreshold: 15,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  // --- LEGUMES ---
  const batataAsterix = await prisma.product.create({
    data: {
      name: "Batata Asterix",
      description: "Batata asterix de casca rosa, ótima para fritar e assar",
      category: "Legumes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Saco 10kg",
          sku: "BAT-SC10",
          unitType: UnitType.FIXED,
          basePrice: 3200,
          stockQuantity: 100,
          lowStockThreshold: 20,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const cenoura = await prisma.product.create({
    data: {
      name: "Cenoura",
      description: "Cenoura fresca de primeira qualidade",
      category: "Legumes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Saco 5kg",
          sku: "CEN-SC5",
          unitType: UnitType.FIXED,
          basePrice: 1400,
          stockQuantity: 80,
          lowStockThreshold: 15,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const abobrinhaItaliana = await prisma.product.create({
    data: {
      name: "Abobrinha Italiana",
      description: "Abobrinha italiana verde, firme e fresca",
      category: "Legumes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "ABO-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 550,
          stockQuantity: 60,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const mandioca = await prisma.product.create({
    data: {
      name: "Mandioca",
      description: "Mandioca descascada e embalada a vácuo",
      category: "Legumes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Saco 5kg",
          sku: "MND-SC5",
          unitType: UnitType.FIXED,
          basePrice: 1200,
          stockQuantity: 50,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const beterraba = await prisma.product.create({
    data: {
      name: "Beterraba",
      description: "Beterraba fresca, cor intensa e sabor adocicado",
      category: "Legumes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Saco 3kg",
          sku: "BET-SC3",
          unitType: UnitType.FIXED,
          basePrice: 900,
          stockQuantity: 40,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  // --- OVOS ---
  const ovoCaipira = await prisma.product.create({
    data: {
      name: "Ovo Caipira",
      description: "Ovos caipira de galinhas criadas soltas, gema alaranjada",
      category: "Ovos",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Cartela 30un",
          sku: "OVO-CT30",
          unitType: UnitType.FIXED,
          basePrice: 2200,
          stockQuantity: 50,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const ovoCodorna = await prisma.product.create({
    data: {
      name: "Ovo de Codorna",
      description: "Ovos de codorna frescos, embalagem higienizada",
      category: "Ovos",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Bandeja 30un",
          sku: "COD-BD30",
          unitType: UnitType.FIXED,
          basePrice: 1200,
          stockQuantity: 30,
          lowStockThreshold: 8,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const ovoBranco = await prisma.product.create({
    data: {
      name: "Ovo Branco",
      description: "Ovos brancos tipo grande, selecionados",
      category: "Ovos",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Cartela 30un",
          sku: "OVB-CT30",
          unitType: UnitType.FIXED,
          basePrice: 1600,
          stockQuantity: 80,
          lowStockThreshold: 15,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  // --- CARNES ---
  const fileMignon = await prisma.product.create({
    data: {
      name: "Filé Mignon",
      description: "Filé mignon bovino de primeira, macio e saboroso",
      category: "Carnes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "FIL-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 8990,
          stockQuantity: 30,
          lowStockThreshold: 8,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const picanha = await prisma.product.create({
    data: {
      name: "Picanha",
      description: "Picanha bovina com capa de gordura, corte nobre",
      category: "Carnes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "PIC-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 6990,
          stockQuantity: 5, // Low stock!
          lowStockThreshold: 8,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const frangoInteiro = await prisma.product.create({
    data: {
      name: "Frango Inteiro",
      description: "Frango inteiro resfriado, limpo e embalado",
      category: "Carnes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "FRA-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 1490,
          stockQuantity: 80,
          lowStockThreshold: 15,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const linguicaToscana = await prisma.product.create({
    data: {
      name: "Linguiça Toscana",
      description: "Linguiça toscana artesanal, temperada na ponta da faca",
      category: "Carnes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Pacote 1kg",
          sku: "LIN-PC1",
          unitType: UnitType.FIXED,
          basePrice: 2400,
          stockQuantity: 40,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const costelaBovina = await prisma.product.create({
    data: {
      name: "Costela Bovina",
      description: "Costela bovina para churrasco, corte janela",
      category: "Carnes",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "COS-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 3490,
          stockQuantity: 0, // Out of stock!
          lowStockThreshold: 10,
          isAvailable: false,
        },
      },
    },
    include: { options: true },
  });

  // --- QUEIJOS ---
  const queijoMinas = await prisma.product.create({
    data: {
      name: "Queijo Minas Frescal",
      description: "Queijo minas frescal artesanal, fresco e leve",
      category: "Queijos",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Peça ~500g",
          sku: "QMF-PC",
          unitType: UnitType.WEIGHT,
          basePrice: 3200,
          stockQuantity: 20,
          lowStockThreshold: 5,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const queijoParmesao = await prisma.product.create({
    data: {
      name: "Queijo Parmesão",
      description: "Parmesão curado 12 meses, sabor intenso",
      category: "Queijos",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "QPA-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 7500,
          stockQuantity: 15,
          lowStockThreshold: 5,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const mussarela = await prisma.product.create({
    data: {
      name: "Mussarela",
      description: "Mussarela fatiada, ideal para pizzas e lanches",
      category: "Queijos",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "MUS-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 3800,
          stockQuantity: 40,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const queijoCoalho = await prisma.product.create({
    data: {
      name: "Queijo Coalho",
      description: "Queijo coalho nordestino, ótimo para grelhar",
      category: "Queijos",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Pacote 500g",
          sku: "QCO-PC500",
          unitType: UnitType.FIXED,
          basePrice: 1800,
          stockQuantity: 25,
          lowStockThreshold: 8,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  // --- TEMPEROS E ERVAS ---
  const alhoNacional = await prisma.product.create({
    data: {
      name: "Alho Nacional",
      description: "Alho nacional graúdo, cabeças firmes e aromáticas",
      category: "Temperos e Ervas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Saco 1kg",
          sku: "ALH-SC1",
          unitType: UnitType.FIXED,
          basePrice: 2800,
          stockQuantity: 60,
          lowStockThreshold: 12,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const cheiroVerde = await prisma.product.create({
    data: {
      name: "Cheiro Verde",
      description: "Mix de salsa e cebolinha frescos",
      category: "Temperos e Ervas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Maço",
          sku: "CHV-MC",
          unitType: UnitType.FIXED,
          basePrice: 200,
          stockQuantity: 100,
          lowStockThreshold: 25,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const manjericao = await prisma.product.create({
    data: {
      name: "Manjericão Fresco",
      description: "Manjericão fresco aromático, folhas grandes",
      category: "Temperos e Ervas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Maço",
          sku: "MNJ-MC",
          unitType: UnitType.FIXED,
          basePrice: 350,
          stockQuantity: 40,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const gengibre = await prisma.product.create({
    data: {
      name: "Gengibre",
      description: "Gengibre fresco, raiz firme e aromática",
      category: "Temperos e Ervas",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "GEN-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 1800,
          stockQuantity: 15,
          lowStockThreshold: 5,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  console.log("✅ 35 produtos criados (7 categorias)");

  // =============================================
  // PRODUCTS + OPTIONS (FreshCo)
  // =============================================
  const cogumeloParis = await prisma.product.create({
    data: {
      name: "Cogumelo Paris",
      description: "Cogumelo paris fresco, ideal para risotos",
      category: "Gourmet",
      tenantId: freshcoTenant.id,
      options: {
        create: {
          name: "Bandeja 500g",
          sku: "FCO-COG-500",
          unitType: UnitType.FIXED,
          basePrice: 2400,
          stockQuantity: 45,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const aspargos = await prisma.product.create({
    data: {
      name: "Aspargos Frescos",
      description: "Aspargos frescos selecionados",
      category: "Gourmet",
      tenantId: freshcoTenant.id,
      options: {
        create: {
          name: "Maço 500g",
          sku: "FCO-ASP-500",
          unitType: UnitType.FIXED,
          basePrice: 3200,
          stockQuantity: 30,
          lowStockThreshold: 8,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const salmao = await prisma.product.create({
    data: {
      name: "Salmao Premium",
      description: "Salmao fresco para pratos especiais",
      category: "Peixes",
      tenantId: freshcoTenant.id,
      options: {
        create: {
          name: "Por kg",
          sku: "FCO-SAL-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 9800,
          stockQuantity: 20,
          lowStockThreshold: 5,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const massaFresca = await prisma.product.create({
    data: {
      name: "Massa Fresca",
      description: "Massa fresca artesanal",
      category: "Mercearia",
      tenantId: freshcoTenant.id,
      options: {
        create: {
          name: "Pacote 1kg",
          sku: "FCO-MAS-1K",
          unitType: UnitType.FIXED,
          basePrice: 2800,
          stockQuantity: 25,
          lowStockThreshold: 6,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const paoArtesanal = await prisma.product.create({
    data: {
      name: "Pao Artesanal",
      description: "Pao de fermentacao natural",
      category: "Padaria",
      tenantId: freshcoTenant.id,
      options: {
        create: {
          name: "Unidade",
          sku: "FCO-PAO-UN",
          unitType: UnitType.FIXED,
          basePrice: 1400,
          stockQuantity: 40,
          lowStockThreshold: 10,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  const azeiteExtra = await prisma.product.create({
    data: {
      name: "Azeite Extra Virgem",
      description: "Azeite extra virgem importado",
      category: "Mercearia",
      tenantId: freshcoTenant.id,
      options: {
        create: {
          name: "Garrafa 500ml",
          sku: "FCO-AZE-500",
          unitType: UnitType.FIXED,
          basePrice: 4500,
          stockQuantity: 35,
          lowStockThreshold: 8,
          isAvailable: true,
        },
      },
    },
    include: { options: true },
  });

  console.log("✅ 6 produtos criados (FreshCo)");

  // =============================================
  // CUSTOMER PRICES (Preços especiais)
  // =============================================

  // Sabor da Terra — 4 overrides
  await prisma.customerPrice.createMany({
    data: [
      {
        customerId: customerSabor.id,
        productOptionId: tomateItaliano.options[0].id,
        price: 720, // R$ 7,20 (de R$ 7,80)
      },
      {
        customerId: customerSabor.id,
        productOptionId: fileMignon.options[0].id,
        price: 8490, // R$ 84,90 (de R$ 89,90)
      },
      {
        customerId: customerSabor.id,
        productOptionId: alfaceCrespa.options[0].id,
        price: 220, // R$ 2,20 (de R$ 2,50)
      },
      {
        customerId: customerSabor.id,
        productOptionId: bananaNanica.options[0].id,
        price: 320, // R$ 3,20/kg (de R$ 3,50)
      },
    ],
  });

  // Cantina Dona Maria — 3 overrides
  await prisma.customerPrice.createMany({
    data: [
      {
        customerId: customerCantina.id,
        productOptionId: mussarela.options[0].id,
        price: 3500, // R$ 35,00/kg (de R$ 38,00)
      },
      {
        customerId: customerCantina.id,
        productOptionId: tomateItaliano.options[0].id,
        price: 700, // R$ 7,00/kg (de R$ 7,80)
      },
      {
        customerId: customerCantina.id,
        productOptionId: manjericao.options[0].id,
        price: 300, // R$ 3,00 (de R$ 3,50)
      },
    ],
  });

  // Bistrô Jardim — 3 overrides
  await prisma.customerPrice.createMany({
    data: [
      {
        customerId: customerBistro.id,
        productOptionId: fileMignon.options[0].id,
        price: 8290, // R$ 82,90/kg (de R$ 89,90)
      },
      {
        customerId: customerBistro.id,
        productOptionId: rucula.options[0].id,
        price: 300, // R$ 3,00 (de R$ 3,50)
      },
      {
        customerId: customerBistro.id,
        productOptionId: queijoParmesao.options[0].id,
        price: 6900, // R$ 69,00/kg (de R$ 75,00)
      },
    ],
  });

  console.log("✅ 10 preços especiais de cliente criados");

  // =============================================
  // ORDERS
  // =============================================

  // --- Order 1: Sabor da Terra - DRAFT ---
  const order1 = await prisma.order.create({
    data: {
      orderNumber: "PED-001",
      customerId: customerSabor.id,
      accountId: saborDaTerra.id,
      createdBy: robertoUser.id,
      status: OrderStatus.DRAFT,
      notes: "Rascunho - pedido semanal de frutas e legumes",
      createdAt: daysAgo(0),
      items: {
        create: [
          {
            productOptionId: bananaNanica.options[0].id,
            requestedQty: 20,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: laranjaPera.options[0].id,
            requestedQty: 3,
            finalPrice: 2500,
            isExtra: false,
          },
          {
            productOptionId: batataAsterix.options[0].id,
            requestedQty: 2,
            finalPrice: 3200,
            isExtra: false,
          },
          {
            productOptionId: cenoura.options[0].id,
            requestedQty: 2,
            finalPrice: 1400,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 2: Sabor da Terra - SENT ---
  const order2 = await prisma.order.create({
    data: {
      orderNumber: "PED-002",
      customerId: customerSabor.id,
      accountId: saborDaTerra.id,
      createdBy: julianaUser.id,
      status: OrderStatus.SENT,
      notes: "Pedido para sexta-feira, favor entregar pela manhã",
      requestedDeliveryDate: daysFromNow(3),
      deliveryTimeSlot: "06:00-10:00",
      deliveryInstructions: "Entregar nos fundos do restaurante, portão amarelo",
      createdAt: daysAgo(1),
      sentAt: daysAgo(1),
      items: {
        create: [
          {
            productOptionId: tomateItaliano.options[0].id,
            requestedQty: 10,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: alfaceCrespa.options[0].id,
            requestedQty: 20,
            finalPrice: 220,
            isExtra: false,
          },
          {
            productOptionId: cheiroVerde.options[0].id,
            requestedQty: 10,
            finalPrice: 200,
            isExtra: false,
          },
          {
            productOptionId: ovoCaipira.options[0].id,
            requestedQty: 5,
            finalPrice: 2200,
            isExtra: false,
          },
          {
            productOptionId: frangoInteiro.options[0].id,
            requestedQty: 8,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: limaoTahiti.options[0].id,
            requestedQty: 4,
            finalPrice: 1500,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 3: Sabor da Terra - IN_SEPARATION ---
  const order3 = await prisma.order.create({
    data: {
      orderNumber: "PED-003",
      customerId: customerSabor.id,
      accountId: saborDaTerra.id,
      createdBy: robertoUser.id,
      status: OrderStatus.IN_SEPARATION,
      notes: "Em separação no depósito - pedido de carnes e hortaliças",
      requestedDeliveryDate: daysFromNow(1),
      deliveryTimeSlot: "06:00-10:00",
      createdAt: daysAgo(2),
      sentAt: daysAgo(2),
      items: {
        create: [
          {
            productOptionId: fileMignon.options[0].id,
            requestedQty: 3,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: picanha.options[0].id,
            requestedQty: 5,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: couveManteiga.options[0].id,
            requestedQty: 10,
            finalPrice: 300,
            isExtra: false,
          },
          {
            productOptionId: cebolaRoxa.options[0].id,
            requestedQty: 3,
            finalPrice: 1800,
            isExtra: false,
          },
          {
            productOptionId: alhoNacional.options[0].id,
            requestedQty: 2,
            finalPrice: 2800,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 4: Sabor da Terra - FINALIZED ---
  const order4 = await prisma.order.create({
    data: {
      orderNumber: "PED-004",
      customerId: customerSabor.id,
      accountId: saborDaTerra.id,
      createdBy: robertoUser.id,
      status: OrderStatus.FINALIZED,
      notes: "Pedido entregue - semana passada",
      requestedDeliveryDate: daysAgo(5),
      deliveryTimeSlot: "06:00-10:00",
      deliveryInstructions: "Deixar com o recepcionista",
      createdAt: daysAgo(8),
      sentAt: daysAgo(7),
      finalizedAt: daysAgo(5),
      items: {
        create: [
          {
            productOptionId: tomateItaliano.options[0].id,
            requestedQty: 15,
            actualWeight: 15.3,
            finalPrice: 720,
            isExtra: false,
          },
          {
            productOptionId: bananaNanica.options[0].id,
            requestedQty: 20,
            actualWeight: 19.8,
            finalPrice: 320,
            isExtra: false,
          },
          {
            productOptionId: alfaceCrespa.options[0].id,
            requestedQty: 15,
            finalPrice: 220,
            isExtra: false,
          },
          {
            productOptionId: fileMignon.options[0].id,
            requestedQty: 2,
            actualWeight: 2.15,
            finalPrice: 8490,
            isExtra: false,
          },
          {
            productOptionId: ovoCaipira.options[0].id,
            requestedQty: 3,
            finalPrice: 2200,
            isExtra: false,
          },
          {
            productOptionId: mandioca.options[0].id,
            requestedQty: 2,
            finalPrice: 1200,
            isExtra: false,
          },
          {
            productOptionId: linguicaToscana.options[0].id,
            requestedQty: 5,
            finalPrice: 2400,
            isExtra: true,
            notes: "Item extra adicionado pelo separador",
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 5: Cantina Dona Maria - DRAFT ---
  const order5 = await prisma.order.create({
    data: {
      orderNumber: "PED-005",
      customerId: customerCantina.id,
      accountId: cantinadonaMaria.id,
      createdBy: mariaUser.id,
      status: OrderStatus.DRAFT,
      notes: "Rascunho cantina - ingredientes para pizza",
      createdAt: daysAgo(0),
      items: {
        create: [
          {
            productOptionId: mussarela.options[0].id,
            requestedQty: 5,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: tomateItaliano.options[0].id,
            requestedQty: 8,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: manjericao.options[0].id,
            requestedQty: 6,
            finalPrice: 300,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 6: Cantina Dona Maria - SENT ---
  const order6 = await prisma.order.create({
    data: {
      orderNumber: "PED-006",
      customerId: customerCantina.id,
      accountId: cantinadonaMaria.id,
      createdBy: mariaUser.id,
      status: OrderStatus.SENT,
      notes: "Pedido urgente - evento sábado",
      requestedDeliveryDate: daysFromNow(2),
      deliveryTimeSlot: "10:00-14:00",
      deliveryInstructions: "Ligar para Dona Maria antes de entregar",
      createdAt: daysAgo(1),
      sentAt: daysAgo(0),
      items: {
        create: [
          {
            productOptionId: mussarela.options[0].id,
            requestedQty: 10,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: tomateItaliano.options[0].id,
            requestedQty: 15,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: manjericao.options[0].id,
            requestedQty: 8,
            finalPrice: 300,
            isExtra: false,
          },
          {
            productOptionId: ovoBranco.options[0].id,
            requestedQty: 10,
            finalPrice: 1600,
            isExtra: false,
          },
          {
            productOptionId: alhoNacional.options[0].id,
            requestedQty: 3,
            finalPrice: 2800,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 7: Cantina Dona Maria - FINALIZED ---
  const order7 = await prisma.order.create({
    data: {
      orderNumber: "PED-007",
      customerId: customerCantina.id,
      accountId: cantinadonaMaria.id,
      createdBy: mariaUser.id,
      status: OrderStatus.FINALIZED,
      notes: "Pedido anterior entregue sem problemas",
      requestedDeliveryDate: daysAgo(4),
      deliveryTimeSlot: "10:00-14:00",
      createdAt: daysAgo(7),
      sentAt: daysAgo(6),
      finalizedAt: daysAgo(4),
      items: {
        create: [
          {
            productOptionId: mussarela.options[0].id,
            requestedQty: 8,
            actualWeight: 8.2,
            finalPrice: 3500,
            isExtra: false,
          },
          {
            productOptionId: queijoMinas.options[0].id,
            requestedQty: 3,
            actualWeight: 2.85,
            finalPrice: 3200,
            isExtra: false,
          },
          {
            productOptionId: frangoInteiro.options[0].id,
            requestedQty: 10,
            actualWeight: 10.4,
            finalPrice: 1490,
            isExtra: false,
          },
          {
            productOptionId: cheiroVerde.options[0].id,
            requestedQty: 5,
            finalPrice: 200,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 8: Bistrô Jardim - SENT ---
  const order8 = await prisma.order.create({
    data: {
      orderNumber: "PED-008",
      customerId: customerBistro.id,
      accountId: bistroJardim.id,
      createdBy: pedroUser.id,
      status: OrderStatus.SENT,
      notes: "Pedido evento especial - jantar harmonizado",
      requestedDeliveryDate: daysFromNow(4),
      deliveryTimeSlot: "06:00-10:00",
      deliveryInstructions: "Entregar pela recepção principal, perguntar por Pedro",
      createdAt: daysAgo(1),
      sentAt: daysAgo(0),
      items: {
        create: [
          {
            productOptionId: fileMignon.options[0].id,
            requestedQty: 5,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: queijoParmesao.options[0].id,
            requestedQty: 2,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: rucula.options[0].id,
            requestedQty: 15,
            finalPrice: 300,
            isExtra: false,
          },
          {
            productOptionId: morango.options[0].id,
            requestedQty: 20,
            finalPrice: 800,
            isExtra: false,
          },
          {
            productOptionId: gengibre.options[0].id,
            requestedQty: 1,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: abobrinhaItaliana.options[0].id,
            requestedQty: 3,
            finalPrice: null,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 9: Chef's Table - SENT (FreshCo) ---
  const order9 = await prisma.order.create({
    data: {
      orderNumber: "FCO-001",
      customerId: customerChefsTable.id,
      accountId: chefsTable.id,
      createdBy: chefUser.id,
      status: OrderStatus.SENT,
      notes: "Pedido degustacao do menu executivo",
      requestedDeliveryDate: daysFromNow(2),
      deliveryTimeSlot: "10:00-14:00",
      deliveryInstructions: "Entregar na cozinha principal",
      createdAt: daysAgo(0),
      sentAt: daysAgo(0),
      items: {
        create: [
          {
            productOptionId: salmao.options[0].id,
            requestedQty: 6,
            finalPrice: null,
            isExtra: false,
          },
          {
            productOptionId: cogumeloParis.options[0].id,
            requestedQty: 8,
            finalPrice: 2400,
            isExtra: false,
          },
          {
            productOptionId: massaFresca.options[0].id,
            requestedQty: 5,
            finalPrice: 2800,
            isExtra: false,
          },
          {
            productOptionId: azeiteExtra.options[0].id,
            requestedQty: 2,
            finalPrice: 4500,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  // --- Order 10: Chef's Table - FINALIZED (FreshCo) ---
  const order10 = await prisma.order.create({
    data: {
      orderNumber: "FCO-002",
      customerId: customerChefsTable.id,
      accountId: chefsTable.id,
      createdBy: chefUser.id,
      status: OrderStatus.FINALIZED,
      notes: "Pedido encerrado - jantar harmonizado",
      requestedDeliveryDate: daysAgo(3),
      deliveryTimeSlot: "08:00-12:00",
      deliveryInstructions: "Entregar no almoxarifado",
      createdAt: daysAgo(6),
      sentAt: daysAgo(5),
      finalizedAt: daysAgo(3),
      items: {
        create: [
          {
            productOptionId: salmao.options[0].id,
            requestedQty: 4,
            actualWeight: 4.3,
            finalPrice: 9800,
            isExtra: false,
          },
          {
            productOptionId: aspargos.options[0].id,
            requestedQty: 6,
            finalPrice: 3200,
            isExtra: false,
          },
          {
            productOptionId: paoArtesanal.options[0].id,
            requestedQty: 10,
            finalPrice: 1400,
            isExtra: false,
          },
        ],
      },
    },
    include: { items: true },
  });

  console.log("✅ 10 pedidos criados (2 DRAFT, 4 SENT, 1 IN_SEPARATION, 3 FINALIZED)");

  // =============================================
  // WEIGHING RECORDS (for finalized orders)
  // =============================================

  // Order 4 weighings (Sabor da Terra - FINALIZED)
  const order4WeightItems = order4.items.filter((i) => i.actualWeight !== null);
  for (const item of order4WeightItems) {
    await prisma.weighing.create({
      data: {
        orderItemId: item.id,
        actualWeight: item.actualWeight!,
        finalPrice: item.finalPrice,
        notes: "Pesagem realizada no depósito",
        userId: anaUser.id,
        createdAt: daysAgo(5),
      },
    });
  }

  // Order 7 weighings (Cantina Dona Maria - FINALIZED)
  const order7WeightItems = order7.items.filter((i) => i.actualWeight !== null);
  for (const item of order7WeightItems) {
    await prisma.weighing.create({
      data: {
        orderItemId: item.id,
        actualWeight: item.actualWeight!,
        finalPrice: item.finalPrice,
        notes: "Pesagem conferida",
        userId: carlosUser.id,
        createdAt: daysAgo(4),
      },
    });
  }

  // Order 10 weighings (Chef's Table - FINALIZED)
  const order10WeightItems = order10.items.filter((i) => i.actualWeight !== null);
  for (const item of order10WeightItems) {
    await prisma.weighing.create({
      data: {
        orderItemId: item.id,
        actualWeight: item.actualWeight!,
        finalPrice: item.finalPrice,
        notes: "Pesagem registrada pelo time FreshCo",
        userId: freshcoOwner.id,
        createdAt: daysAgo(3),
      },
    });
  }

  console.log("✅ 9 registros de pesagem criados");

  // =============================================
  // STOCK MOVEMENTS
  // =============================================
  const stockMovements = [
    // Restock from supplier
    {
      productOptionId: tomateItaliano.options[0].id,
      type: StockMovementType.MANUAL_ADDITION,
      quantity: 100,
      notes: "Recebimento do fornecedor Chácara Boa Vista",
      userId: carlosUser.id,
      createdAt: daysAgo(10),
    },
    {
      productOptionId: fileMignon.options[0].id,
      type: StockMovementType.MANUAL_ADDITION,
      quantity: 50,
      notes: "Recebimento do frigorífico São Paulo",
      userId: carlosUser.id,
      createdAt: daysAgo(10),
    },
    {
      productOptionId: mussarela.options[0].id,
      type: StockMovementType.MANUAL_ADDITION,
      quantity: 60,
      notes: "Recebimento do laticínio Serra da Mantiqueira",
      userId: anaUser.id,
      createdAt: daysAgo(9),
    },
    {
      productOptionId: bananaNanica.options[0].id,
      type: StockMovementType.MANUAL_ADDITION,
      quantity: 300,
      notes: "Recebimento de banana do Vale do Ribeira",
      userId: anaUser.id,
      createdAt: daysAgo(8),
    },
    // Order finalized deductions (Order 4)
    {
      productOptionId: tomateItaliano.options[0].id,
      type: StockMovementType.ORDER_FINALIZED,
      quantity: -15.3,
      orderId: order4.id,
      notes: "Dedução pedido PED-004",
      userId: anaUser.id,
      createdAt: daysAgo(5),
    },
    {
      productOptionId: bananaNanica.options[0].id,
      type: StockMovementType.ORDER_FINALIZED,
      quantity: -19.8,
      orderId: order4.id,
      notes: "Dedução pedido PED-004",
      userId: anaUser.id,
      createdAt: daysAgo(5),
    },
    {
      productOptionId: fileMignon.options[0].id,
      type: StockMovementType.ORDER_FINALIZED,
      quantity: -2.15,
      orderId: order4.id,
      notes: "Dedução pedido PED-004",
      userId: anaUser.id,
      createdAt: daysAgo(5),
    },
    // Order finalized deductions (Order 7)
    {
      productOptionId: mussarela.options[0].id,
      type: StockMovementType.ORDER_FINALIZED,
      quantity: -8.2,
      orderId: order7.id,
      notes: "Dedução pedido PED-007",
      userId: carlosUser.id,
      createdAt: daysAgo(4),
    },
    {
      productOptionId: frangoInteiro.options[0].id,
      type: StockMovementType.ORDER_FINALIZED,
      quantity: -10.4,
      orderId: order7.id,
      notes: "Dedução pedido PED-007",
      userId: carlosUser.id,
      createdAt: daysAgo(4),
    },
    // Inventory adjustments
    {
      productOptionId: costelaBovina.options[0].id,
      type: StockMovementType.ADJUSTMENT,
      quantity: -50,
      notes: "Ajuste de inventário - lote vencido descartado",
      userId: carlosUser.id,
      createdAt: daysAgo(3),
    },
    {
      productOptionId: espinafre.options[0].id,
      type: StockMovementType.ADJUSTMENT,
      quantity: -12,
      notes: "Ajuste - perda por deterioração",
      userId: anaUser.id,
      createdAt: daysAgo(2),
    },
    // Recent restock
    {
      productOptionId: alfaceCrespa.options[0].id,
      type: StockMovementType.MANUAL_ADDITION,
      quantity: 40,
      notes: "Reposição semanal de hortaliças",
      userId: anaUser.id,
      createdAt: daysAgo(1),
    },
    {
      productOptionId: cheiroVerde.options[0].id,
      type: StockMovementType.MANUAL_ADDITION,
      quantity: 50,
      notes: "Reposição semanal de hortaliças",
      userId: anaUser.id,
      createdAt: daysAgo(1),
    },
    // FreshCo restock
    {
      productOptionId: salmao.options[0].id,
      type: StockMovementType.MANUAL_ADDITION,
      quantity: 25,
      notes: "Recebimento de salmao premium",
      userId: freshcoOwner.id,
      createdAt: daysAgo(2),
    },
    {
      productOptionId: cogumeloParis.options[0].id,
      type: StockMovementType.MANUAL_ADDITION,
      quantity: 40,
      notes: "Recebimento de cogumelos frescos",
      userId: freshcoOwner.id,
      createdAt: daysAgo(1),
    },
    // Order finalized deductions (Order 10)
    {
      productOptionId: salmao.options[0].id,
      type: StockMovementType.ORDER_FINALIZED,
      quantity: -4.3,
      orderId: order10.id,
      notes: "Dedução pedido FCO-002",
      userId: freshcoOwner.id,
      createdAt: daysAgo(3),
    },
  ];

  for (const mv of stockMovements) {
    await prisma.stockMovement.create({ data: mv });
  }
  console.log("✅ 16 movimentações de estoque criadas");

  // =============================================
  // ORDER ACTIVITIES
  // =============================================
  const activities = [
    // Order 1 (DRAFT)
    {
      orderId: order1.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: robertoUser.id,
      description: "Pedido PED-001 criado como rascunho",
      createdAt: daysAgo(0),
    },
    // Order 2 (SENT)
    {
      orderId: order2.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: julianaUser.id,
      description: "Pedido PED-002 criado por Juliana Lima",
      createdAt: daysAgo(1),
    },
    {
      orderId: order2.id,
      activityType: OrderActivityType.ORDER_SUBMITTED,
      userId: julianaUser.id,
      description: "Pedido PED-002 enviado para a distribuidora",
      createdAt: daysAgo(1),
    },
    {
      orderId: order2.id,
      activityType: OrderActivityType.DELIVERY_SCHEDULED,
      userId: julianaUser.id,
      description: "Entrega agendada para horário 06:00-10:00",
      createdAt: daysAgo(1),
    },
    // Order 3 (IN_SEPARATION)
    {
      orderId: order3.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: robertoUser.id,
      description: "Pedido PED-003 criado por Roberto Santos",
      createdAt: daysAgo(2),
    },
    {
      orderId: order3.id,
      activityType: OrderActivityType.ORDER_SUBMITTED,
      userId: robertoUser.id,
      description: "Pedido PED-003 enviado para a distribuidora",
      createdAt: daysAgo(2),
    },
    {
      orderId: order3.id,
      activityType: OrderActivityType.ORDER_STATUS_CHANGED,
      userId: anaUser.id,
      description: "Status alterado para Em Separação",
      metadata: {
        oldStatus: "SENT",
        newStatus: "IN_SEPARATION",
      },
      createdAt: daysAgo(1),
    },
    // Order 4 (FINALIZED)
    {
      orderId: order4.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: robertoUser.id,
      description: "Pedido PED-004 criado por Roberto Santos",
      createdAt: daysAgo(8),
    },
    {
      orderId: order4.id,
      activityType: OrderActivityType.ORDER_SUBMITTED,
      userId: robertoUser.id,
      description: "Pedido PED-004 enviado para a distribuidora",
      createdAt: daysAgo(7),
    },
    {
      orderId: order4.id,
      activityType: OrderActivityType.ORDER_STATUS_CHANGED,
      userId: carlosUser.id,
      description: "Status alterado para Em Separação",
      metadata: { oldStatus: "SENT", newStatus: "IN_SEPARATION" },
      createdAt: daysAgo(6),
    },
    {
      orderId: order4.id,
      activityType: OrderActivityType.ITEM_WEIGHED,
      userId: anaUser.id,
      description: "Tomate Italiano pesado: 15,3kg (solicitado: 15kg)",
      metadata: { requestedQty: 15, actualWeight: 15.3 },
      createdAt: daysAgo(5),
    },
    {
      orderId: order4.id,
      activityType: OrderActivityType.ITEM_WEIGHED,
      userId: anaUser.id,
      description: "Banana Nanica pesada: 19,8kg (solicitado: 20kg)",
      metadata: { requestedQty: 20, actualWeight: 19.8 },
      createdAt: daysAgo(5),
    },
    {
      orderId: order4.id,
      activityType: OrderActivityType.ITEM_WEIGHED,
      userId: anaUser.id,
      description: "Filé Mignon pesado: 2,15kg (solicitado: 2kg)",
      metadata: { requestedQty: 2, actualWeight: 2.15 },
      createdAt: daysAgo(5),
    },
    {
      orderId: order4.id,
      activityType: OrderActivityType.ITEM_ADDED,
      userId: anaUser.id,
      description: "Item extra adicionado: Linguiça Toscana (5 pacotes)",
      metadata: { productName: "Linguiça Toscana", quantity: 5, isExtra: true },
      createdAt: daysAgo(5),
    },
    {
      orderId: order4.id,
      activityType: OrderActivityType.ORDER_FINALIZED,
      userId: carlosUser.id,
      description: "Pedido PED-004 finalizado e entregue",
      createdAt: daysAgo(5),
    },
    // Order 5 (DRAFT)
    {
      orderId: order5.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: mariaUser.id,
      description: "Pedido PED-005 criado como rascunho",
      createdAt: daysAgo(0),
    },
    // Order 6 (SENT)
    {
      orderId: order6.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: mariaUser.id,
      description: "Pedido PED-006 criado por Maria Costa",
      createdAt: daysAgo(1),
    },
    {
      orderId: order6.id,
      activityType: OrderActivityType.ORDER_SUBMITTED,
      userId: mariaUser.id,
      description: "Pedido PED-006 enviado para a distribuidora",
      createdAt: daysAgo(0),
    },
    {
      orderId: order6.id,
      activityType: OrderActivityType.NOTE_ADDED,
      userId: mariaUser.id,
      description: "Nota adicionada: Pedido urgente - evento sábado",
      createdAt: daysAgo(0),
    },
    // Order 7 (FINALIZED)
    {
      orderId: order7.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: mariaUser.id,
      description: "Pedido PED-007 criado por Maria Costa",
      createdAt: daysAgo(7),
    },
    {
      orderId: order7.id,
      activityType: OrderActivityType.ORDER_SUBMITTED,
      userId: mariaUser.id,
      description: "Pedido PED-007 enviado para a distribuidora",
      createdAt: daysAgo(6),
    },
    {
      orderId: order7.id,
      activityType: OrderActivityType.ITEM_WEIGHED,
      userId: carlosUser.id,
      description: "Mussarela pesada: 8,2kg (solicitado: 8kg)",
      metadata: { requestedQty: 8, actualWeight: 8.2 },
      createdAt: daysAgo(4),
    },
    {
      orderId: order7.id,
      activityType: OrderActivityType.ITEM_WEIGHED,
      userId: carlosUser.id,
      description: "Queijo Minas pesado: 2,85kg (solicitado: 3kg)",
      metadata: { requestedQty: 3, actualWeight: 2.85 },
      createdAt: daysAgo(4),
    },
    {
      orderId: order7.id,
      activityType: OrderActivityType.ITEM_WEIGHED,
      userId: carlosUser.id,
      description: "Frango Inteiro pesado: 10,4kg (solicitado: 10kg)",
      metadata: { requestedQty: 10, actualWeight: 10.4 },
      createdAt: daysAgo(4),
    },
    {
      orderId: order7.id,
      activityType: OrderActivityType.ORDER_FINALIZED,
      userId: carlosUser.id,
      description: "Pedido PED-007 finalizado e entregue",
      createdAt: daysAgo(4),
    },
    // Order 8 (SENT)
    {
      orderId: order8.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: pedroUser.id,
      description: "Pedido PED-008 criado por Pedro Almeida",
      createdAt: daysAgo(1),
    },
    {
      orderId: order8.id,
      activityType: OrderActivityType.ORDER_SUBMITTED,
      userId: pedroUser.id,
      description: "Pedido PED-008 enviado para a distribuidora",
      createdAt: daysAgo(0),
    },
    {
      orderId: order8.id,
      activityType: OrderActivityType.DELIVERY_SCHEDULED,
      userId: pedroUser.id,
      description: "Entrega agendada para jantar harmonizado",
      createdAt: daysAgo(0),
    },
    // Order 9 (Chef's Table - SENT)
    {
      orderId: order9.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: chefUser.id,
      description: "Pedido FCO-001 criado por Rafael Moreira",
      createdAt: daysAgo(0),
    },
    {
      orderId: order9.id,
      activityType: OrderActivityType.ORDER_SUBMITTED,
      userId: chefUser.id,
      description: "Pedido FCO-001 enviado para a distribuidora",
      createdAt: daysAgo(0),
    },
    {
      orderId: order9.id,
      activityType: OrderActivityType.DELIVERY_SCHEDULED,
      userId: chefUser.id,
      description: "Entrega agendada para 10:00-14:00",
      createdAt: daysAgo(0),
    },
    // Order 10 (Chef's Table - FINALIZED)
    {
      orderId: order10.id,
      activityType: OrderActivityType.ORDER_CREATED,
      userId: chefUser.id,
      description: "Pedido FCO-002 criado por Rafael Moreira",
      createdAt: daysAgo(6),
    },
    {
      orderId: order10.id,
      activityType: OrderActivityType.ORDER_SUBMITTED,
      userId: chefUser.id,
      description: "Pedido FCO-002 enviado para a distribuidora",
      createdAt: daysAgo(5),
    },
    {
      orderId: order10.id,
      activityType: OrderActivityType.ORDER_STATUS_CHANGED,
      userId: freshcoOwner.id,
      description: "Status alterado para Em Separação",
      metadata: { oldStatus: "SENT", newStatus: "IN_SEPARATION" },
      createdAt: daysAgo(4),
    },
    {
      orderId: order10.id,
      activityType: OrderActivityType.ITEM_WEIGHED,
      userId: freshcoOwner.id,
      description: "Salmao pesado: 4,3kg (solicitado: 4kg)",
      metadata: { requestedQty: 4, actualWeight: 4.3 },
      createdAt: daysAgo(3),
    },
    {
      orderId: order10.id,
      activityType: OrderActivityType.ORDER_FINALIZED,
      userId: freshcoOwner.id,
      description: "Pedido FCO-002 finalizado e entregue",
      createdAt: daysAgo(3),
    },
  ];

  for (const act of activities) {
    await prisma.orderActivity.create({ data: act });
  }
  console.log("✅ 36 atividades de pedidos criadas");

  // =============================================
  // TENANT SETTINGS
  // =============================================
  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      minDeliveryDaysAhead: 1,
      maxDeliveryDaysAhead: 14,
      deliveryDaysAllowed: [1, 2, 3, 4, 5],
      deliveryTimeSlots: {
        "1": ["06:00-10:00", "10:00-14:00"],
        "2": ["06:00-10:00", "10:00-14:00"],
        "3": ["06:00-10:00", "10:00-14:00"],
        "4": ["06:00-10:00", "10:00-14:00"],
        "5": ["06:00-10:00", "10:00-14:00"],
      },
      operatingDays: [1, 2, 3, 4, 5],
      allowSameDayOrders: false,
      autoConfirmOrders: false,
    },
  });
  await prisma.tenantSettings.create({
    data: {
      tenantId: freshcoTenant.id,
      minDeliveryDaysAhead: 2,
      maxDeliveryDaysAhead: 21,
      deliveryDaysAllowed: [2, 3, 4, 5, 6],
      deliveryTimeSlots: {
        "2": ["08:00-12:00", "12:00-16:00"],
        "3": ["08:00-12:00", "12:00-16:00"],
        "4": ["08:00-12:00", "12:00-16:00"],
        "5": ["08:00-12:00", "12:00-16:00"],
        "6": ["08:00-12:00"],
      },
      operatingDays: [2, 3, 4, 5, 6],
      allowSameDayOrders: false,
      autoConfirmOrders: true,
    },
  });
  console.log("✅ Configurações dos tenants criadas");

  // =============================================
  // USER PREFERENCES
  // =============================================
  await prisma.userPreferences.createMany({
    data: [
      {
        userId: adminUser.id,
        theme: "dark",
        density: "compact",
        notifyOrderStatus: true,
        notifyLowStock: true,
        notifyNewOrders: true,
      },
      {
        userId: carlosUser.id,
        theme: "light",
        density: "comfortable",
        notifyOrderStatus: true,
        notifyLowStock: true,
        notifyNewOrders: true,
      },
      {
        userId: anaUser.id,
        theme: "system",
        density: "comfortable",
        notifyOrderStatus: true,
        notifyLowStock: true,
        notifyNewOrders: true,
      },
      {
        userId: robertoUser.id,
        theme: "light",
        density: "comfortable",
        notifyOrderStatus: true,
        notifyLowStock: false,
        notifyNewOrders: false,
      },
      {
        userId: mariaUser.id,
        theme: "dark",
        density: "comfortable",
        notifyOrderStatus: true,
        notifyLowStock: false,
        notifyNewOrders: false,
      },
      {
        userId: pedroUser.id,
        theme: "light",
        density: "compact",
        notifyOrderStatus: true,
        notifyLowStock: false,
        notifyNewOrders: false,
      },
      {
        userId: julianaUser.id,
        theme: "system",
        density: "comfortable",
        notifyOrderStatus: true,
        notifyLowStock: false,
        notifyNewOrders: true,
      },
      {
        userId: freshcoOwner.id,
        theme: "light",
        density: "comfortable",
        notifyOrderStatus: true,
        notifyLowStock: true,
        notifyNewOrders: true,
      },
      {
        userId: chefUser.id,
        theme: "dark",
        density: "compact",
        notifyOrderStatus: true,
        notifyLowStock: false,
        notifyNewOrders: false,
      },
    ],
  });
  console.log("✅ Preferências de 9 usuários criadas");

  // =============================================
  // DELIVERY NOTES (for finalized orders)
  // =============================================
  await prisma.deliveryNote.create({
    data: {
      orderId: order4.id,
      generatedBy: anaUser.id,
      generatedAt: daysAgo(5),
    },
  });
  await prisma.deliveryNote.create({
    data: {
      orderId: order7.id,
      generatedBy: carlosUser.id,
      generatedAt: daysAgo(4),
    },
  });
  await prisma.deliveryNote.create({
    data: {
      orderId: order10.id,
      generatedBy: freshcoOwner.id,
      generatedAt: daysAgo(3),
    },
  });
  console.log("✅ 3 notas de entrega criadas");

  // =============================================
  // AUDIT LOGS
  // =============================================
  await prisma.auditLog.createMany({
    data: [
      {
        eventType: "AUTH_LOGIN",
        severity: "INFO",
        action: "User login",
        success: true,
        userId: chefUser.id,
        tenantId: freshcoTenant.id,
        accountId: chefsTable.id,
        resourceType: "User",
        resourceId: chefUser.id,
        details: { method: "dev-mode" },
        ipAddress: "127.0.0.1",
        userAgent: "SeedScript",
        createdAt: daysAgo(6),
      },
      {
        eventType: "ORDER_SUBMITTED",
        severity: "INFO",
        action: "Order submitted",
        success: true,
        userId: chefUser.id,
        tenantId: freshcoTenant.id,
        accountId: chefsTable.id,
        resourceType: "Order",
        resourceId: order10.id,
        details: { orderNumber: "FCO-002" },
        ipAddress: "127.0.0.1",
        userAgent: "SeedScript",
        createdAt: daysAgo(5),
      },
      {
        eventType: "ORDER_FINALIZED",
        severity: "INFO",
        action: "Order finalized",
        success: true,
        userId: freshcoOwner.id,
        tenantId: freshcoTenant.id,
        accountId: chefsTable.id,
        resourceType: "Order",
        resourceId: order10.id,
        details: { orderNumber: "FCO-002" },
        ipAddress: "127.0.0.1",
        userAgent: "SeedScript",
        createdAt: daysAgo(3),
      },
      {
        eventType: "STOCK_ADJUSTED",
        severity: "WARNING",
        action: "Inventory adjustment",
        success: true,
        userId: carlosUser.id,
        tenantId: tenant.id,
        accountId: saborDaTerra.id,
        resourceType: "ProductOption",
        resourceId: costelaBovina.options[0].id,
        details: { reason: "lote vencido" },
        ipAddress: "127.0.0.1",
        userAgent: "SeedScript",
        createdAt: daysAgo(3),
      },
      {
        eventType: "CUSTOMER_PRICE_SET",
        severity: "INFO",
        action: "Customer price override",
        success: true,
        userId: anaUser.id,
        tenantId: tenant.id,
        accountId: saborDaTerra.id,
        resourceType: "CustomerPrice",
        resourceId: "seed-customer-price",
        details: { customerId: customerSabor.id },
        ipAddress: "127.0.0.1",
        userAgent: "SeedScript",
        createdAt: daysAgo(4),
      },
    ],
  });
  console.log("✅ 5 logs de auditoria criados");

  // =============================================
  // SUMMARY
  // =============================================
  console.log("\n🎉 Seed do banco de dados concluído com sucesso!\n");
  console.log("📋 Resumo:");
  console.log("   - Roles: 5");
  console.log("   - Usuários: 9");
  console.log("   - Tenants: 2 (Verde Campo Distribuidora, FreshCo Distribuidora)");
  console.log("   - Contas: 4 (Sabor da Terra, Cantina Dona Maria, Bistro Jardim, Chef's Table)");
  console.log("   - Clientes: 4");
  console.log("   - Produtos: 41 (11 categorias)");
  console.log("   - Preços especiais: 10");
  console.log("   - Pedidos: 10 (2 DRAFT, 4 SENT, 1 IN_SEPARATION, 3 FINALIZED)");
  console.log("   - Pesagens: 9");
  console.log("   - Movimentações de estoque: 16");
  console.log("   - Atividades de pedidos: 36");
  console.log("   - Configurações de tenant: 2");
  console.log("   - Preferências de usuário: 9");
  console.log("   - Notas de entrega: 3");
  console.log("   - Logs de auditoria: 5");
  console.log("\n🔑 Credenciais de Teste:");
  console.log("   Admin:           admin@freshflow.com");
  console.log("   Tenant Owner:    carlos@verdecampo.com.br");
  console.log("   Tenant Owner:    owner@freshco.com");
  console.log("   Tenant Admin:    ana@verdecampo.com.br");
  console.log("   Account Owner:   roberto@sabordaterra.com.br");
  console.log("   Account Owner:   maria@cantinadonamaria.com.br");
  console.log("   Account Owner:   pedro@bistrojardim.com.br");
  console.log("   Account Owner:   chef@chefstable.com");
  console.log("   Account Buyer:   juliana@sabordaterra.com.br");
  console.log("\n📦 Categorias de Produtos:");
  console.log("   Frutas (7) | Hortaliças (7) | Legumes (5)");
  console.log("   Ovos (3) | Carnes (5) | Queijos (4) | Temperos e Ervas (4)");
  console.log("   Gourmet (2) | Peixes (1) | Mercearia (2) | Padaria (1)");
  console.log("\n⚠️  Alertas de Estoque:");
  console.log("   - Espinafre: 8 maços (mínimo: 10)");
  console.log("   - Picanha: 5kg (mínimo: 8)");
  console.log("   - Costela Bovina: 0kg (INDISPONÍVEL)");
}

main()
  .catch((e) => {
    console.error("❌ Erro durante seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
