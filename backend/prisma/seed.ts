import { PrismaClient, RoleType, UnitType, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clean existing data (in reverse order of dependencies)
  await prisma.weighing.deleteMany();
  await prisma.deliveryNote.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customerPrice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.productOption.deleteMany();
  await prisma.product.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.account.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();

  console.log("✨ Cleaned existing data");

  // Create Roles
  const roles = await Promise.all([
    prisma.role.create({ data: { name: RoleType.PLATFORM_ADMIN } }),
    prisma.role.create({ data: { name: RoleType.TENANT_OWNER } }),
    prisma.role.create({ data: { name: RoleType.TENANT_ADMIN } }),
    prisma.role.create({ data: { name: RoleType.ACCOUNT_OWNER } }),
    prisma.role.create({ data: { name: RoleType.ACCOUNT_BUYER } }),
  ]);
  console.log("✅ Created 5 roles");

  // Create Platform Admin User
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@freshflow.com",
      supabaseId: "00000000-0000-0000-0000-000000000001",
      name: "Platform Admin",
    },
  });

  await prisma.membership.create({
    data: {
      userId: adminUser.id,
      roleId: roles.find((r) => r.name === RoleType.PLATFORM_ADMIN)!.id,
    },
  });
  console.log("✅ Created platform admin user");

  // Create Tenant (Distributor)
  const tenant = await prisma.tenant.create({
    data: {
      name: "FreshCo Distributors",
      slug: "freshco",
    },
  });
  console.log("✅ Created tenant: FreshCo Distributors");

  // Create Tenant Owner User
  const tenantOwner = await prisma.user.create({
    data: {
      email: "owner@freshco.com",
      supabaseId: "00000000-0000-0000-0000-000000000002",
      name: "FreshCo Owner",
    },
  });

  await prisma.membership.create({
    data: {
      userId: tenantOwner.id,
      roleId: roles.find((r) => r.name === RoleType.TENANT_OWNER)!.id,
      tenantId: tenant.id,
    },
  });
  console.log("✅ Created tenant owner user");

  // Create Account (Restaurant)
  const account = await prisma.account.create({
    data: {
      name: "Chef's Table Restaurant",
      slug: "chefs-table",
      tenantId: tenant.id,
    },
  });
  console.log("✅ Created account: Chef's Table Restaurant");

  // Create Account Owner User (Chef)
  const chefUser = await prisma.user.create({
    data: {
      email: "chef@chefstable.com",
      supabaseId: "00000000-0000-0000-0000-000000000003",
      name: "Head Chef",
    },
  });

  await prisma.membership.create({
    data: {
      userId: chefUser.id,
      roleId: roles.find((r) => r.name === RoleType.ACCOUNT_OWNER)!.id,
      accountId: account.id,
    },
  });
  console.log("✅ Created chef user");

  // Create Customer (linked to Account)
  const customer = await prisma.customer.create({
    data: {
      accountId: account.id,
    },
  });
  console.log("✅ Created customer record");

  // Create Products with Options
  const tomatoesProduct = await prisma.product.create({
    data: {
      name: "Tomatoes",
      description: "Fresh organic tomatoes",
      category: "Vegetables",
      tenantId: tenant.id,
      options: {
        create: {
          name: "1kg box",
          sku: "TOM-1KG-BOX",
          unitType: UnitType.FIXED,
          basePrice: 850, // R$ 8.50
        },
      },
    },
    include: { options: true },
  });

  const lettuceProduct = await prisma.product.create({
    data: {
      name: "Lettuce",
      description: "Crispy fresh lettuce",
      category: "Vegetables",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Unit",
          sku: "LET-UNIT",
          unitType: UnitType.FIXED,
          basePrice: 350, // R$ 3.50
        },
      },
    },
    include: { options: true },
  });

  const fishProduct = await prisma.product.create({
    data: {
      name: "Fresh Fish",
      description: "Daily catch fish",
      category: "Seafood",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Per kg",
          sku: "FISH-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 4500, // R$ 45.00 per kg
        },
      },
    },
    include: { options: true },
  });

  const beefProduct = await prisma.product.create({
    data: {
      name: "Beef",
      description: "Premium beef cuts",
      category: "Meat",
      tenantId: tenant.id,
      options: {
        create: {
          name: "Per kg",
          sku: "BEEF-KG",
          unitType: UnitType.WEIGHT,
          basePrice: 6000, // R$ 60.00 per kg
        },
      },
    },
    include: { options: true },
  });

  const potatoesProduct = await prisma.product.create({
    data: {
      name: "Potatoes",
      description: "Fresh potatoes",
      category: "Vegetables",
      tenantId: tenant.id,
      options: {
        create: {
          name: "5kg bag",
          sku: "POT-5KG-BAG",
          unitType: UnitType.FIXED,
          basePrice: 1200, // R$ 12.00
        },
      },
    },
    include: { options: true },
  });

  console.log("✅ Created 5 products with options");

  // Create Customer Price Overrides (2-3 items)
  await prisma.customerPrice.create({
    data: {
      customerId: customer.id,
      productOptionId: fishProduct.options[0].id,
      price: 4200, // R$ 42.00 (discount from R$ 45.00)
    },
  });

  await prisma.customerPrice.create({
    data: {
      customerId: customer.id,
      productOptionId: beefProduct.options[0].id,
      price: 5500, // R$ 55.00 (discount from R$ 60.00)
    },
  });

  await prisma.customerPrice.create({
    data: {
      customerId: customer.id,
      productOptionId: tomatoesProduct.options[0].id,
      price: 800, // R$ 8.00 (discount from R$ 8.50)
    },
  });

  console.log("✅ Created 3 customer price overrides");

  // Create Sample Order (SENT status)
  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-${Date.now()}`,
      customerId: customer.id,
      accountId: account.id,
      status: OrderStatus.SENT,
      sentAt: new Date(),
      notes: "Sample order for testing",
      items: {
        create: [
          {
            productOptionId: tomatoesProduct.options[0].id,
            requestedQty: 5, // 5 boxes
            finalPrice: 800, // Customer price
            isExtra: false,
          },
          {
            productOptionId: fishProduct.options[0].id,
            requestedQty: 2.5, // 2.5 kg requested
            finalPrice: null, // Will be set after weighing
            isExtra: false,
          },
          {
            productOptionId: beefProduct.options[0].id,
            requestedQty: 3, // 3 kg requested
            finalPrice: null, // Will be set after weighing
            isExtra: false,
          },
        ],
      },
    },
    include: {
      items: {
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  console.log(`✅ Created sample order: ${order.orderNumber}`);

  console.log("\n🎉 Database seed completed successfully!");
  console.log("\n📋 Summary:");
  console.log(`   - Roles: 5`);
  console.log(`   - Users: 3 (admin, tenant owner, chef)`);
  console.log(`   - Tenant: 1 (FreshCo Distributors)`);
  console.log(`   - Account: 1 (Chef's Table Restaurant)`);
  console.log(`   - Products: 5 (2 FIXED, 2 WEIGHT, 1 FIXED)`);
  console.log(`   - Customer Prices: 3 overrides`);
  console.log(`   - Sample Order: 1 (SENT status with 3 items)`);
  console.log("\n🔑 Test Credentials:");
  console.log(`   Admin: admin@freshflow.com`);
  console.log(`   Tenant Owner: owner@freshco.com`);
  console.log(`   Chef: chef@chefstable.com`);
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
