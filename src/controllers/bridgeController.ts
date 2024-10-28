import { RouteCalculator } from "../services/routeCalculator";
import { BridgeRequest, ChainBalance } from "../types";
import redisClient from "../config/redis";
import { CHAIN_CONFIG } from "../config/chains";
import { ethers } from "ethers";

// ERC20 ABI - we only need balanceOf function
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export class BridgeController {
  private routeCalculator: RouteCalculator;
  private CACHE_TTL = 300; // 5 minutes
  private isTestMode = false;
  private testBalances?: Record<string, number>;

  constructor() {
    this.routeCalculator = new RouteCalculator();
  }

  setTestMode(balances: Record<string, number>) {
    this.isTestMode = true;
    this.testBalances = balances;
  }

  private async getChainBalance(
    chain: string,
    tokenAddress: string,
    userAddress: string,
    retryCount = 3
  ): Promise<number> {
    if (this.isTestMode && this.testBalances) {
      return this.testBalances[chain] || 0;
    }

    console.log(`Checking balance for ${chain}:`, {
      tokenAddress,
      userAddress,
    });

    const rpcUrl = CHAIN_CONFIG[chain].rpcUrl;
    let lastError: any;

    for (let i = 0; i < retryCount; i++) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        provider.pollingInterval = 1000;

        await Promise.race([
          provider.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Provider timeout")), 15000)
          ),
        ]);

        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

        const [balanceBigInt, decimals] = await Promise.all([
          contract.balanceOf(userAddress),
          contract.decimals(),
        ]);

        console.log(`Got decimals for ${chain}:`, decimals);
        console.log(`Got raw balance for ${chain}:`, balanceBigInt.toString());

        const formatted = ethers.formatUnits(balanceBigInt, decimals);
        const result = parseFloat(formatted);

        console.log(`Calculated balance for ${chain}:`, result);
        return result;
      } catch (error: unknown) {
        lastError = error;
        console.error(
          `Attempt ${i + 1} failed for ${chain}:`,
          (error as Error).message
        );

        if (chain === "gnosis" && (error as any).code === "CALL_EXCEPTION") {
          console.warn(
            `Gnosis chain balance check failed, assuming zero balance`
          );
          return 0;
        }

        if (
          (error as any).code === "CALL_EXCEPTION" ||
          (error as any).code === "TIMEOUT"
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, i) * 1000)
          );
          continue;
        }

        break;
      }
    }

    console.error(`All attempts failed for ${chain}:`, lastError);
    return 0;
  }

  async getOptimalRoutes(request: BridgeRequest) {
    console.log("Starting route calculation for:", {
      targetChain: request.targetChain,
      amount: request.amount,
      userAddress: request.userAddress.slice(0, 10) + "...",
    });

    if (!CHAIN_CONFIG[request.targetChain]) {
      throw new Error(`Unsupported target chain: ${request.targetChain}`);
    }

    const cacheKey = `routes:${request.userAddress}:${request.targetChain}:${request.amount}:${request.tokenAddress}`;

    try {
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        console.log("Returning cached result");
        return JSON.parse(cachedResult);
      }

      console.log("Fetching balances from chains:", Object.keys(CHAIN_CONFIG));

      const balancePromises = Object.keys(CHAIN_CONFIG).map(
        async (chain): Promise<ChainBalance> => {
          const balance = await this.getChainBalance(
            chain,
            CHAIN_CONFIG[chain].usdcAddress,
            request.userAddress
          );

          console.log(`Balance for ${chain}:`, balance);

          return {
            chain,
            balance,
            bridgeFee: 0,
          };
        }
      );

      const balances = await Promise.all(balancePromises);
      const targetBalance = balances.find(b => b.chain === request.targetChain)?.balance || 0;

      console.log("All chain balances:", balances);
      console.log(`Target chain (${request.targetChain}) balance:`, targetBalance);

      if (targetBalance >= request.amount) {
        const result = {
          success: true,
          data: {
            routes: [],
            totalFee: 0,
            totalAmount: targetBalance,
            estimatedTotalTime: 0,
            availableBalance: targetBalance,
            requiredAmount: request.amount,
            insufficientFunds: false,
            noValidRoutes: false,
            bridgeRoutes: [],
            targetChain: request.targetChain,
            shortfall: 0
          }
        };
        await redisClient.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(result));
        return result;
      }

      const routes = await this.routeCalculator.findOptimalRoutes(
        balances,
        request.targetChain,
        request.amount,
        request.tokenAddress,
        request.userAddress
      );

      let errorMessage = null;
      if (routes.insufficientFunds) {
        errorMessage = "Insufficient funds across all chains";
      } else if (routes.noValidRoutes) {
        errorMessage = "No valid routes available";
      }

      const result = {
        success: routes.totalAmount >= request.amount,
        data: {
          routes: routes.routes,
          totalFee: routes.totalFee,
          totalAmount: routes.totalAmount,
          estimatedTotalTime: routes.estimatedTotalTime,
          availableBalance: routes.availableBalance,
          requiredAmount: request.amount,
          insufficientFunds: routes.insufficientFunds,
          noValidRoutes: routes.noValidRoutes,
          bridgeRoutes: routes.bridgeRoutes,
          targetChain: request.targetChain,
          shortfall: Math.max(0, request.amount - routes.totalAmount),
        },
        error: errorMessage
      };

      await redisClient.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      return result;
    } catch (error) {
      console.error("Error in getOptimalRoutes:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        data: {
          routes: [],
          totalFee: 0,
          totalAmount: 0,
          estimatedTotalTime: 0,
          availableBalance: 0,
          requiredAmount: request.amount,
          insufficientFunds: true,
          noValidRoutes: true,
          bridgeRoutes: [],
          targetChain: request.targetChain,
          shortfall: request.amount,
        },
      };
    }
  }
}
