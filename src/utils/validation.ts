import { z } from "zod";

export const bridgeRequestSchema = z.object({
  targetChain: z.string(),
  amount: z.number().positive(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});
