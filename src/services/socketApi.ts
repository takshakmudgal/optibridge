import axios from "axios";
import redisClient from "../config/redis";
import { CHAIN_CONFIG } from "../config/chains";
import { ENV } from "../config/env";
import { SocketQuoteResponse } from "../types/socket";
import { BASE_GAS_FEE, BRIDGE_FEES, GAS_MULTIPLIERS } from "../config/bridgeFees";
import { ethers } from "ethers";

const CACHE_TTL = 300; // 5 minutes

export class SocketApiService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.socket.tech/v2";
  private providers: Record<string, ethers.JsonRpcProvider>;

  constructor() {
    this.apiKey = ENV.SOCKET_API_KEY;
    this.providers = {};
    
   
    Object.entries(CHAIN_CONFIG).forEach(([chain, config]) => {
      this.providers[chain] = new ethers.JsonRpcProvider(config.rpcUrl, undefined, {
        staticNetwork: true,
        polling: true,
        pollingInterval: 4000
      });
    });
  }

  private async getGasPrice(chain: string): Promise<bigint> {
    try {
      const provider = this.providers[chain];
      if (!provider) {
        throw new Error(`No provider found for chain: ${chain}`);
      }

    
      const feeData = await provider.getFeeData();
      return feeData.gasPrice ?? BigInt(0);
    } catch (error) {
      console.error(`Error getting gas price for ${chain}:`, error);
 
      return BigInt(30000000000);
    }
  }

  private async calculateFallbackFees(
    fromChain: string,
    toChain: string,
    amount: number
  ): Promise<{ gasFee: number; bridgeFee: number }> {

    const bridgeFeePercentage = BRIDGE_FEES[fromChain]?.[toChain] || 1.5;
    const gasMultiplier = GAS_MULTIPLIERS[fromChain] || 1;
    

    const gasPrice = await this.getGasPrice(fromChain);
    const gasPriceInGwei = Number(ethers.formatUnits(gasPrice, "gwei"));
    
  
    const AVERAGE_GAS_UNITS = 200000; 
    const baseGasFee = (gasPriceInGwei * AVERAGE_GAS_UNITS * gasMultiplier) / 1e9;
    const baseBridgeFee = (amount * bridgeFeePercentage) / 100;
    
 
    const volumeDiscount = amount > 1000 ? 0.8 : amount > 500 ? 0.9 : 1;
    
    
    const minFee = 0.5;
    
    return {
      gasFee: Math.max(Number(baseGasFee.toFixed(6)), minFee),
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
  
      const amountInWei = Math.floor(Number(amount) * 1e6).toString();
      
   
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

    
      if (gasFee < 0.5 || bridgeFee < 0.5) {
        const fallbackFees = await this.calculateFallbackFees(
          fromChain,
          toChain,
          Number(amount)
        );
        gasFee = fallbackFees.gasFee;
        bridgeFee = fallbackFees.bridgeFee;
      }

      
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
    
      const fallbackFees = await this.calculateFallbackFees(
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
              estimatedTime: 300,
              protocol: "fallback",
            },
          ],
        },
      };
    }
  }
}
