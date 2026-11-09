import { z } from 'zod';
import { toCents } from './format.js';

const money = (label) => z.string().transform((v, ctx) => {
  const c = toCents(v);
  if (Number.isNaN(c)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a number like 12.50.` });
  return c;
});
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Enter a valid date.' });

export const productSchema = z.object({
  id: z.coerce.number().int().optional(),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, { message: 'SKU: 3–32 letters, numbers or dashes.' }),
  name: z.string().trim().min(3, { message: 'Enter a product name.' }).max(120),
  category: z.string().trim().min(2, { message: 'Enter a category.' }).max(40),
  unit: z.string().trim().min(1).max(16),
  priceCents: money('Price'),
  costCents: money('Cost').optional(),
  reorderLevel: z.coerce.number().int().min(0).max(100000),
  openingQty: z.coerce.number().int().min(0).max(1000000).optional(),
  active: z.boolean(),
});

export const adjustSchema = z.object({
  productId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().refine((n) => n !== 0, { message: 'Enter a quantity other than zero.' }),
  reason: z.string().trim().min(3, { message: 'Give a short reason, e.g. "Cycle count" or "Damaged".' }).max(120),
});

export const partnerSchema = z.object({
  kind: z.enum(['customer', 'supplier']),
  name: z.string().trim().min(2, { message: 'Enter a company name.' }).max(120),
  contact: z.string().trim().max(80).optional(),
  email: z.union([z.literal(''), z.string().trim().email({ message: 'Enter a valid email or leave it blank.' })]).optional(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(60).optional(),
});

const line = z.object({
  productId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().min(1, { message: 'Quantities must be at least 1.' }).max(100000),
  unitCents: z.coerce.number().int().min(0).optional(),
});

export const saleSchema = z.object({
  customerId: z.coerce.number().int().positive({ message: 'Choose a customer.' }),
  orderDate: isoDate,
  notes: z.string().trim().max(500).optional(),
  lines: z.array(line).min(1, { message: 'Add at least one product line.' }).max(50),
});

export const purchaseSchema = z.object({
  supplierId: z.coerce.number().int().positive({ message: 'Choose a supplier.' }),
  orderDate: isoDate,
  expectedDate: z.union([z.literal(''), isoDate]).optional(),
  notes: z.string().trim().max(500).optional(),
  lines: z.array(line).min(1, { message: 'Add at least one product line.' }).max(50),
});

export const userSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Enter a valid email.' }),
  name: z.string().trim().min(2, { message: 'Enter a name.' }).max(80),
  role: z.enum(['admin', 'sales', 'warehouse']),
  password: z.string().min(8, { message: 'Passwords need at least 8 characters.' }).max(200),
});
