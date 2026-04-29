import { z } from "zod";

export const OrderStatusSchema = z.enum(["DRAFT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"]);

export const CreateOrderSchema = z.object({
  ownerId: z.string().min(1).max(120).optional(),
  projectId: z.string().min(1),
  itemsJson: z.array(z.record(z.string(), z.unknown())).default([]),
  totalCents: z.number().int().nonnegative().default(0),
  status: OrderStatusSchema.default("DRAFT"),
});

