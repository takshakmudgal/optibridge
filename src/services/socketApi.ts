import axios from "axios";
import redisClient from "../config/redis";
import { CHAIN_CONFIG } from "../config/chains";
import { ENV } from "../config/env";
import { SocketQuoteResponse } from "../types/socket";
import { BRIDGE_FEES } from "../config/bridgeFees";

const CACHE_TTL = 300; // 5 minutes

export class SocketApiService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.socket.tech/v2";

  constructor() {
    this.apiKey = ENV.SOCKET_API_KEY;
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
    const fromChainId = CHAIN_CONFIG[fromChain]?.chainId;
    const toChainId = CHAIN_CONFIG[toChain]?.chainId;

    if (!fromChainId || !toChainId) {
      throw new Error(
        `Invalid chain specified: ${!fromChainId ? fromChain : toChain}`
      );
    }

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
            fromChainId: fromChainId.toString(),
            toChainId: toChainId.toString(),
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
      const gasFee = Number(bestRoute.totalGasFeeUSD || 0);
      const bridgeFee = Number(bestRoute.totalBridgeFeeUSD || 0);

      // Ensure fees are displayed with proper precision
      return {
        route: {
          userTxs: [
            {
              gasFee: Number(gasFee.toFixed(6)),
              bridgeFee: Number(bridgeFee.toFixed(6)),
              estimatedTime: bestRoute.serviceTime || 60,
              protocol: bestRoute.protocol || "unknown",
            },
          ],
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Socket API Error:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        
        // Add retry logic for 500 errors
        if (error.response?.status === 500) {
          console.log("Retrying request due to 500 error...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.getBridgeFees(fromChain, toChain, amount, tokenAddress, userAddress);
        }
        
        throw new Error(`Socket API error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }
}
