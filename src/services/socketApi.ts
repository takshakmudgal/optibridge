import axios from "axios";
import redisClient from "../config/redis";
import { CHAIN_CONFIG } from "../config/chains";
import { ENV } from "../config/env";
import { SocketQuoteResponse } from "../types/socket";
import { BASE_GAS_FEE, BRIDGE_FEES, GAS_MULTIPLIERS } from "../config/bridgeFees";

const CACHE_TTL = 300; // 5 minutes

export class SocketApiService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.socket.tech/v2";

  constructor() {
    this.apiKey = ENV.SOCKET_API_KEY;
  }

  private calculateFallbackFees(
    fromChain: string,
    toChain: string,
    amount: number
  ): { gasFee: number; bridgeFee: number } {
    // Get the base bridge fee from configuration
    const bridgeFeePercentage = BRIDGE_FEES[fromChain]?.[toChain] || 1.5;
    const gasMultiplier = GAS_MULTIPLIERS[fromChain] || 1;
    
    // Calculate fees
    // Base bridge fee is a percentage of the amount
    const baseBridgeFee = (amount * bridgeFeePercentage) / 100;
    
    // Base gas fee calculation with chain-specific multiplier
    const baseGasFee = Math.max(
      (amount * 0.001), // 0.1% minimum gas fee
      BASE_GAS_FEE * gasMultiplier * amount // Scale with amount
    );
    
    // Apply volume-based discounts for larger amounts
    const volumeDiscount = amount > 1000 ? 0.8 : amount > 500 ? 0.9 : 1;
    
    // Ensure minimum fees
    const minFee = 0.5; // Minimum fee of 0.5 USDC
    
    return {
      gasFee: Math.max(Number((baseGasFee * gasMultiplier).toFixed(6)), minFee),
      bridgeFee: Math.max(Number((baseBridgeFee * volumeDiscount).toFixed(6)), minFee)
    };
  }

  async getBridgeFees(
    fromChain: string,
    toChain: string,
    amount: string,
    tokenAddress: string,
    userAddress: string
  ): Promise<{
    route: {
      userTxs: Array<{
        gasFee: number;
        bridgeFee: number;
        estimatedTime: number;
        protocol: string;
      }>;
    };
  }> {
    try {
      // Convert amount to Wei (6 decimals for USDC)
      const amountInWei = Math.floor(Number(amount) * 1e6).toString();
      
      // Use the correct token addresses from the source and target chains
      const fromTokenAddress = CHAIN_CONFIG[fromChain].usdcAddress;
      const toTokenAddress = CHAIN_CONFIG[toChain].usdcAddress;

      console.log("Requesting Socket API quote:", {
        fromChain,
        toChain,
        amount: amountInWei,
        fromTokenAddress,
        toTokenAddress,
        userAddress,
      });

      const response = await axios.get<SocketQuoteResponse>(
        `${this.baseUrl}/quote`,
        {
          headers: {
            "API-KEY": this.apiKey,
            Accept: "application/json",
          },
          params: {
            fromChainId: CHAIN_CONFIG[fromChain]?.chainId.toString(),
            toChainId: CHAIN_CONFIG[toChain]?.chainId.toString(),
            fromTokenAddress,
            toTokenAddress,
            fromAmount: amountInWei,
            userAddress,
            uniqueRoutesPerBridge: true,
            sort: "output",
            singleTxOnly: true,
          },
        }
      );

      if (!response.data.success) {
        console.error("Socket API error response:", response.data);
        throw new Error(`Socket API request failed: ${(response.data as any).message || 'Unknown error'}`);
      }

      if (!response.data.result?.routes?.length) {
        console.warn(`No routes available from ${fromChain} to ${toChain}`);
        throw new Error(`No valid routes found from ${fromChain} to ${toChain}`);
      }

      const bestRoute = response.data.result.routes[0];
      let gasFee = Number(bestRoute.totalGasFeeUSD || 0);
      let bridgeFee = Number(bestRoute.totalBridgeFeeUSD || 0);

      // If API returns zero or very low fees, use fallback calculation
      if (gasFee < 0.5 || bridgeFee < 0.5) {
        const fallbackFees = this.calculateFallbackFees(
          fromChain,
          toChain,
          Number(amount)
        );
        gasFee = fallbackFees.gasFee;
        bridgeFee = fallbackFees.bridgeFee;
      }

      // Ensure fees are displayed with proper precision
      return {
        route: {
          userTxs: [
            {
              gasFee: Number(gasFee.toFixed(6)),
              bridgeFee: Number(bridgeFee.toFixed(6)),
              estimatedTime: bestRoute.serviceTime || 300,
              protocol: bestRoute.protocol || "unknown",
            },
          ],
        },
      };
    } catch (error) {
      // Use fallback fees when API fails
      const fallbackFees = this.calculateFallbackFees(
        fromChain,
        toChain,
        Number(amount)
      );

      return {
        route: {
          userTxs: [
            {
              gasFee: fallbackFees.gasFee,
              bridgeFee: fallbackFees.bridgeFee,
              estimatedTime: 300, // 5 minutes default
              protocol: "fallback",
            },
          ],
        },
      };
    }
  }
}
