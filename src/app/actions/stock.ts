"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { v2 as cloudinary } from "cloudinary";
import { notifyStockIn } from "@/lib/telegram";

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

  if (!ALLOWED_TYPES.includes(file.type) && file.type !== "") {
    return { error: "Only JPEG, PNG, WebP or AVIF images are accepted." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "Image must be smaller than 5 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

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
  brandId: z.string().min(1),
  modelId: z.string().optional(),
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

  const { tags, modelId, ...rest } = parsed.data;
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

  await prisma.product.create({
    data: {
      ...rest,
      modelId: modelId || null,
      tags: tagList,
      imageUrl,
      imagePublicId,
    },
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

  const { tags, modelId, ...rest } = parsed.data;
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

  const updated = await prisma.product.update({
    where: { id },
    data: { ...rest, modelId: modelId || null, tags: tagList, imageUrl, imagePublicId },
  });

  // Record price history if cost or selling price changed
  const oldCost = Number(existing.costPrice);
  const newCost = Number(updated.costPrice);
  const oldSell = Number(existing.sellingPrice);
  const newSell = Number(updated.sellingPrice);
  if (oldCost !== newCost || oldSell !== newSell) {
    await prisma.priceHistory.create({
      data: {
        productId: id,
        oldCostPrice: oldCost,
        newCostPrice: newCost,
        oldSellPrice: oldSell,
        newSellPrice: newSell,
      },
    });
  }

  revalidatePath("/stock");
  revalidatePath(`/stock/${id}`);
  redirect("/stock");
}

const StockInSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  note: z.string().optional(),
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

  const { quantity, note } = parsed.data;

  const [, product, user] = await Promise.all([
    prisma.$transaction([
      prisma.stockMovement.create({
        data: { productId, type: "IN", quantity, note: note || null, userId: session.userId },
      }),
      prisma.product.update({
        where: { id: productId },
        data: { stockQty: { increment: quantity } },
      }),
    ]),
    prisma.product.findUnique({
      where: { id: productId },
      include: { brand: true, model: true },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);

  if (product && user) {
    notifyStockIn(
      [{ productName: product.name, brandName: product.brand.name, modelName: product.model?.name ?? null, quantity, costPrice: Number(product.costPrice) }],
      user.name,
      note || null
    ).catch(() => {});
  }

  revalidatePath("/stock");
  revalidatePath(`/stock/${productId}`);
  redirect("/stock");
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
          data: { productId, type: "IN", quantity, note, userId: session.userId },
        }),
        prisma.product.update({
          where: { id: productId },
          data: { stockQty: { increment: quantity } },
        }),
      ])
    ),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true, model: true },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);

  if (user && products.length > 0) {
    notifyStockIn(
      items.map(({ productId, quantity }) => {
        const p = products.find((x) => x.id === productId)!;
        return { productName: p.name, brandName: p.brand.name, modelName: p.model?.name ?? null, quantity, costPrice: Number(p.costPrice) };
      }),
      user.name,
      note
    ).catch(() => {});
  }

  revalidatePath("/stock");
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
