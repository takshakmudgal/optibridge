import { z } from "zod";

export const bridgeRequestSchema = z.object({
  targetChain: z.string(),
  amount: z.number().positive(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  // Temporarily make userAddress validation more permissive
  userAddress: z.string().startsWith('0x'),
});
