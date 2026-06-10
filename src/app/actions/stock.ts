"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.string().optional(),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  modelId: z.string().optional(),
  qualityGrade: z.enum(["ORIGINAL", "COPY_A", "COPY_B", "OTHER"]),
  costPrice: z.coerce.number().positive(),
  sellingPrice: z.coerce.number().positive(),
  stockQty: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
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

  const parsed = ProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { tags, modelId, ...rest } = parsed.data;
  const tagList = tags ? tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];

  let imageUrl: string | undefined;
  let imagePublicId: string | undefined;

  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "hm-stocks" }, (err, res) => {
            if (err || !res) reject(err);
            else resolve(res as { secure_url: string; public_id: string });
          })
          .end(buffer);
      }
    );
    imageUrl = result.secure_url;
    imagePublicId = result.public_id;
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

  const parsed = ProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { tags, modelId, ...rest } = parsed.data;
  const tagList = tags ? tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return { error: "Product not found" };

  let imageUrl = existing.imageUrl ?? undefined;
  let imagePublicId = existing.imagePublicId ?? undefined;

  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    if (imagePublicId) {
      await cloudinary.uploader.destroy(imagePublicId);
    }
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "hm-stocks" }, (err, res) => {
            if (err || !res) reject(err);
            else resolve(res as { secure_url: string; public_id: string });
          })
          .end(buffer);
      }
    );
    imageUrl = result.secure_url;
    imagePublicId = result.public_id;
  }

  await prisma.product.update({
    where: { id },
    data: { ...rest, modelId: modelId || null, tags: tagList, imageUrl, imagePublicId },
  });

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

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        productId,
        type: "IN",
        quantity,
        note: note || null,
        userId: session.userId,
      },
    }),
    prisma.product.update({
      where: { id: productId },
      data: { stockQty: { increment: quantity } },
    }),
  ]);

  revalidatePath("/stock");
  revalidatePath(`/stock/${productId}`);
  redirect(`/stock/${productId}`);
}

export async function deleteProduct(id: string) {
  const session = await verifySession();
  if (session.role !== "ADMIN") return { error: "Unauthorized" };

  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/stock");
  redirect("/stock");
}
