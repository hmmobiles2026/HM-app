"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, verifyRole } from "@/lib/dal";
import { roundMoney } from "@/lib/credit-math";
import { v2 as cloudinary } from "cloudinary";
import { notifyStockIn } from "@/lib/telegram";
import { after } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

async function uploadImage(
  file: File
): Promise<{ url: string; publicId: string } | { error: string }> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return { error: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to environment variables." };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Only JPEG, PNG, WebP or AVIF images are accepted." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "Image must be smaller than 5 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader
    .upload(dataUri, { folder: "hm-stocks", resource_type: "image" })
    .catch((err) => {
      console.error("Cloudinary upload error:", err);
      return null;
    });

  if (!result) return { error: "Image upload failed. Verify Cloudinary credentials are correct." };
  return { url: result.secure_url, publicId: result.public_id };
}

const BaseProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.string().optional(),
  categoryId: z.string().min(1),
  partBrandId: z.string().optional(),
  brandId: z.string().min(1),
  modelId: z.string().optional(),
  supplierId: z.string().optional(),
  qualityGrade: z.enum(["ORIGINAL", "COPY_A", "COPY_B", "OTHER"]),
  costPrice: z.coerce.number().positive(),
  sellingPrice: z.coerce.number().positive(),
  lowStockThreshold: z.coerce.number().int().min(0),
});

const CreateProductSchema = BaseProductSchema.extend({
  stockQty: z.coerce.number().int().min(0),
});

export type ProductFormState =
  | { errors?: Record<string, string[]>; error?: string }
  | undefined;

export async function createProduct(
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const session = await verifySession();
  if (session.role === "SELLER") return { error: "Unauthorized" };

  const parsed = CreateProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { tags, modelId, partBrandId, supplierId, ...rest } = parsed.data;
  const tagList = tags
    ? tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  let imageUrl: string | undefined;
  let imagePublicId: string | undefined;

  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    const uploaded = await uploadImage(imageFile);
    if ("error" in uploaded) return { error: uploaded.error };
    imageUrl = uploaded.url;
    imagePublicId = uploaded.publicId;
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        ...rest,
        modelId: modelId || null,
        partBrandId: partBrandId || null,
        supplierId: supplierId || null,
        tags: tagList,
        imageUrl,
        imagePublicId,
      },
    });
    if (rest.stockQty > 0) {
      await tx.stockMovement.create({
        data: {
          productId: created.id,
          type: "IN",
          quantity: rest.stockQty,
          note: "Initial stock",
          userId: session.userId,
        },
      });
    }
  });

  revalidatePath("/stock");
  redirect("/stock");
}

export async function updateProduct(
  id: string,
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const session = await verifySession();
  if (session.role === "SELLER") return { error: "Unauthorized" };

  const parsed = BaseProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { tags, modelId, partBrandId, supplierId, ...rest } = parsed.data;
  const tagList = tags
    ? tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return { error: "Product not found" };

  let imageUrl = existing.imageUrl ?? undefined;
  let imagePublicId = existing.imagePublicId ?? undefined;

  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    if (imagePublicId) {
      await cloudinary.uploader.destroy(imagePublicId).catch(() => {});
    }
    const uploaded = await uploadImage(imageFile);
    if ("error" in uploaded) return { error: uploaded.error };
    imageUrl = uploaded.url;
    imagePublicId = uploaded.publicId;
  }

  const oldCost = Number(existing.costPrice);
  const oldSell = Number(existing.sellingPrice);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: { ...rest, modelId: modelId || null, partBrandId: partBrandId || null, supplierId: supplierId || null, tags: tagList, imageUrl, imagePublicId },
    });
    const newCost = Number(updated.costPrice);
    const newSell = Number(updated.sellingPrice);
    if (oldCost !== newCost || oldSell !== newSell) {
      await tx.priceHistory.create({
        data: {
          productId: id,
          oldCostPrice: oldCost,
          newCostPrice: newCost,
          oldSellPrice: oldSell,
          newSellPrice: newSell,
        },
      });
    }
  });

  revalidatePath("/stock");
  revalidatePath(`/stock/${id}`);
  redirect("/stock");
}

const StockInSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  note: z.string().optional(),
  supplierId: z.string().optional(),
});

export async function addStock(
  productId: string,
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const session = await verifySession();
  if (session.role === "SELLER") return { error: "Unauthorized" };

  const parsed = StockInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { quantity, note, supplierId } = parsed.data;

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: { productId, type: "IN", quantity, note: note || null, userId: session.userId, supplierId: supplierId || null },
    }),
    prisma.product.update({
      where: { id: productId },
      data: { stockQty: { increment: quantity } },
    }),
  ]);

  const [product, user] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: { brand: true, model: true, partBrand: true },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);

  if (product && user) {
    const _product = product;
    const _userName = user.name;
    after(() =>
      notifyStockIn(
        [{ productName: _product.name, brandName: _product.brand.name, modelName: _product.model?.name ?? null, partBrandName: _product.partBrand?.name ?? null, quantity, costPrice: Number(_product.costPrice) }],
        _userName,
        note || null
      )
    );
  }

  revalidatePath("/stock");
  revalidatePath(`/stock/${productId}`);
  redirect(`/stock/${productId}`);
}

export type BulkStockInState =
  | { error?: string; success?: string }
  | undefined;

export async function addStockBulk(
  _state: BulkStockInState,
  formData: FormData
): Promise<BulkStockInState> {
  const session = await verifySession();
  if (session.role === "SELLER") return { error: "Unauthorized" };

  const note = (formData.get("note") as string | null) || null;
  const supplierId = (formData.get("supplierId") as string | null) || null;

  const items: { productId: string; quantity: number }[] = [];
  let i = 0;
  while (true) {
    const productId = formData.get(`product_${i}`) as string | null;
    if (!productId) break;
    const quantity = Number(formData.get(`qty_${i}`));
    if (quantity > 0) items.push({ productId, quantity });
    i++;
  }

  if (items.length === 0) return { error: "Add at least one product." };

  const productIds = items.map((it) => it.productId);

  const [, products, user] = await Promise.all([
    prisma.$transaction(
      items.flatMap(({ productId, quantity }) => [
        prisma.stockMovement.create({
          data: { productId, type: "IN", quantity, note, userId: session.userId, supplierId: supplierId || null },
        }),
        prisma.product.update({
          where: { id: productId },
          data: { stockQty: { increment: quantity } },
        }),
      ])
    ),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true, model: true, partBrand: true },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);

  if (user && products.length > 0) {
    const _products = products;
    const _userName = user.name;
    const _items = items;
    after(() =>
      notifyStockIn(
        _items.map(({ productId, quantity }) => {
          const p = _products.find((x) => x.id === productId)!;
          return { productName: p.name, brandName: p.brand.name, modelName: p.model?.name ?? null, partBrandName: p.partBrand?.name ?? null, quantity, costPrice: Number(p.costPrice) };
        }),
        _userName,
        note
      )
    );
  }

  revalidatePath("/stock");
  for (const { productId } of items) revalidatePath(`/stock/${productId}`);
  redirect("/stock");
}

export async function deleteProduct(id: string): Promise<{ error?: string; success?: string }> {
  const session = await verifySession();
  if (session.role === "SELLER") return { error: "Unauthorized" };

  await prisma.product.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  });

  revalidatePath("/stock");
  return { success: "Product moved to trash." };
}

export async function recoverProduct(id: string): Promise<{ error?: string; success?: string }> {
  const session = await verifySession();
  if (session.role === "SELLER") return { error: "Unauthorized" };

  await prisma.product.update({
    where: { id },
    data: { isActive: true, deletedAt: null },
  });

  revalidatePath("/stock");
  return { success: "Product recovered." };
}

// ── Stock adjustments ────────────────────────────────────────────────────────

export type StockAdjustState = { error?: string; success?: string } | undefined;

const AdjustSchema = z.object({
  direction: z.enum(["remove", "add"]),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1."),
  reason: z.enum(["DAMAGED", "WRONG_ITEM", "LOST", "COUNT_CORRECTION", "OTHER"]),
  note: z.string().trim().optional(),
  claim: z.string().optional(),
  supplierId: z.string().optional(),
  claimAmount: z.string().optional(),
});

const REASON_LABEL: Record<string, string> = {
  DAMAGED: "Damaged",
  WRONG_ITEM: "Wrong item received",
  LOST: "Lost",
  COUNT_CORRECTION: "Count correction",
  OTHER: "Other",
};

/**
 * Correct a stock count, with a stated reason.
 *
 * The only way stock can move outside a sale or a stock-in. Before this existed there
 * was no way to record a damaged part at all: the count stayed wrong, or somebody rang
 * up a fake sale. The ADJUSTMENT movements it writes are what the stock history and
 * the daily report's "written off today" section have always been reading.
 *
 * Owner and Admin only — letting sellers make stock disappear is how shrinkage hides.
 */
export async function adjustStock(
  productId: string,
  _state: StockAdjustState,
  formData: FormData
): Promise<StockAdjustState> {
  const session = await verifyRole(["ADMIN", "OWNER"]);

  const parsed = AdjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat();
    return { error: msgs[0] ?? "Check the details and try again." };
  }

  const { direction, quantity, reason, note, supplierId } = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, stockQty: true, costPrice: true, isActive: true },
  });
  if (!product) return { error: "Product not found." };
  if (!product.isActive) return { error: "This product has been deleted." };

  const removing = direction === "remove";
  if (removing && quantity > product.stockQty) {
    return {
      error: `Only ${product.stockQty} in stock — cannot remove ${quantity}.`,
    };
  }

  const unitCost = Number(product.costPrice);
  const signed = removing ? -quantity : quantity;

  // A claim only makes sense for stock going out, and only against a named supplier.
  const wantsClaim = parsed.data.claim === "true" || parsed.data.claim === "on";
  const claiming = wantsClaim && removing && !!supplierId;
  if (wantsClaim && removing && !supplierId) {
    return { error: "Choose which supplier you are claiming from." };
  }

  let claimAmount: number | null = null;
  if (claiming) {
    const raw = Number(parsed.data.claimAmount);
    // Defaults to what the stock cost you, which is what you are actually out of pocket.
    claimAmount = Number.isFinite(raw) && raw > 0 ? roundMoney(raw) : roundMoney(unitCost * quantity);
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { stockQty: { increment: signed } },
    }),
    prisma.stockMovement.create({
      data: {
        productId,
        type: "ADJUSTMENT",
        quantity: signed,
        reason,
        unitCost,
        note: note || null,
        supplierId: claiming ? supplierId! : null,
        claimAmount,
        claimStatus: claiming ? "PENDING" : null,
        userId: session.userId,
      },
    }),
  ]);

  revalidatePath("/stock");
  revalidatePath(`/stock/${productId}`);
  revalidatePath("/dashboard");
  revalidatePath("/sales");

  const verb = removing ? "Removed" : "Added";
  const claimNote = claiming
    ? ` Claim of LKR ${claimAmount!.toLocaleString("en-LK")} raised with the supplier.`
    : "";
  return {
    success: `${verb} ${quantity} × ${product.name} — ${REASON_LABEL[reason]}.${claimNote}`,
  };
}

/** Mark a supplier claim on a stock adjustment as settled. */
export async function resolveStockClaim(movementId: string): Promise<StockAdjustState> {
  await verifyRole(["ADMIN", "OWNER"]);
  const m = await prisma.stockMovement.findUnique({
    where: { id: movementId },
    select: { claimStatus: true },
  });
  if (!m?.claimStatus) return { error: "That is not an open claim." };
  if (m.claimStatus === "RESOLVED") return { error: "Already resolved." };

  await prisma.stockMovement.update({
    where: { id: movementId },
    data: { claimStatus: "RESOLVED", resolvedAt: new Date() },
  });
  revalidatePath("/sales");
  revalidatePath("/stock");
  return { success: "Claim marked as resolved." };
}
