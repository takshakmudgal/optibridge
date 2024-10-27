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
  ) {
    const fromChainId = CHAIN_CONFIG[fromChain]?.chainId;
    const toChainId = CHAIN_CONFIG[toChain]?.chainId;

    if (!fromChainId || !toChainId) {
      throw new Error(
        `Invalid chain specified: ${!fromChainId ? fromChain : toChain}`
      );
    }

    if (fromChain === toChain) {
      return {
        route: {
          userTxs: [
            {
              gasFee: 0,
              bridgeFee: 0, // No bridge fee needed if same chain
              estimatedTime: 0,
            },
          ],
        },
      };
    }

    const cacheKey = `bridge_fee:${fromChainId}:${toChainId}:${amount}:${tokenAddress}`;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    try {
      const amountInWei = (Number(amount) * 1e6).toString();

      console.log("Requesting Socket API quote:", {
        fromChain,
        toChain,
        amount: amountInWei,
        fromTokenAddress: CHAIN_CONFIG[fromChain].usdcAddress,
        toTokenAddress: CHAIN_CONFIG[toChain].usdcAddress,
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
            fromTokenAddress: CHAIN_CONFIG[fromChain].usdcAddress,
            toTokenAddress: CHAIN_CONFIG[toChain].usdcAddress,
            fromAmount: amountInWei,
            userAddress: userAddress,
            uniqueRoutesPerBridge: true,
            sort: "output",
            singleTxOnly: true,
          },
        }
      );

      console.log("Socket API Response:", {
        success: response.data.success,
        routesCount: response.data.result?.routes?.length || 0,
      });

      if (!response.data.success) {
        throw new Error(
          `Socket API request failed for ${fromChain} to ${toChain}`
        );
      }

      if (!response.data.result?.routes?.length) {
        console.log(
          `No Socket routes available, using fallback fees for ${fromChain} to ${toChain}`
        );
        return {
          route: {
            userTxs: [
              {
                gasFee: 0,
                bridgeFee: BRIDGE_FEES[fromChain]?.[toChain] || 0,
                estimatedTime: 60,
                protocol: "fallback",
              },
            ],
          },
        };
      }

      const bestRoute = response.data.result.routes[0];
      const bridgeFee = BRIDGE_FEES[fromChain]?.[toChain] || 0;

      const result = {
        route: {
          userTxs: [
            {
              gasFee: Number(bestRoute.totalGasFeeUSD || 0),
              bridgeFee: bridgeFee,
              estimatedTime: bestRoute.serviceTime || 60,
            },
          ],
        },
      };

      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
      return result;
    } catch (error: any) {
      console.error("Socket API Error Details:", {
        status: error.response?.status,
        data: error.response?.data,
        config: {
          ...error.config,
          headers: {
            ...error.config?.headers,
            "API-KEY": "***",
          },
        },
      });

      console.log(
        `Using fallback fees for ${fromChain} to ${toChain} due to API error`
      );
      return {
        route: {
          userTxs: [
            {
              gasFee: 0,
              bridgeFee: BRIDGE_FEES[fromChain]?.[toChain] || 0,
              estimatedTime: 60,
              protocol: "fallback",
            },
          ],
        },
      };
    }
  }
}
