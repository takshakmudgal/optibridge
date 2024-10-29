import { ChainBalance, BridgeRoute, RouteResponse } from "../types";
import { SocketApiService } from "./socketApi";
import { CHAIN_CONFIG } from "../config/chains";
import { BRIDGE_FEES } from "../config/bridgeFees";

interface CombinationResult {
  chains: string[];
  totalAmount: number;
  totalFee: number;
  routes: BridgeRoute[];
}

export class RouteCalculator {
  private socketApiService: SocketApiService;

  constructor() {
    this.socketApiService = new SocketApiService();
  }

  private async calculateSingleSourceRoute(
    sourceChain: ChainBalance,
    targetChain: string,
    amount: number,
    tokenAddress: string,
    userAddress: string
  ): Promise<BridgeRoute> {
    const neededAmount = Number(amount.toFixed(6));
    
    try {
      const bridgeFees = await this.socketApiService.getBridgeFees(
        sourceChain.chain,
        targetChain,
        neededAmount.toString(),
        tokenAddress,
        userAddress
      );

      const gasFee = bridgeFees.route.userTxs[0].gasFee;
      const bridgeFee = bridgeFees.route.userTxs[0].bridgeFee;
      const totalFee = Number((gasFee + bridgeFee).toFixed(6));

      const minFee = 0.000001;
      const finalFee = totalFee > 0 ? Math.max(totalFee, minFee) : minFee;

      return {
        sourceChain: sourceChain.chain,
        amount: neededAmount,
        fee: finalFee,
        estimatedTime: bridgeFees.route.userTxs[0].estimatedTime,
        protocol: bridgeFees.route.userTxs[0].protocol,
        gasToken: CHAIN_CONFIG[sourceChain.chain].nativeToken,
        sourceBalance: sourceChain.balance
      };
    } catch (error) {
      console.error(`Error calculating route fees: ${error}`);
      throw error;
    }
  }

  private getCombinations<T>(arr: T[]): T[][] {
    const result: T[][] = [];
    
    for (let i = 1; i < (1 << arr.length); i++) {
      const combination: T[] = [];
      for (let j = 0; j < arr.length; j++) {
        if (i & (1 << j)) {
          combination.push(arr[j]);
        }
      }
      result.push(combination);
    }
    
    return result;
  }

  private async evaluateCombination(
    sourceChains: ChainBalance[],
    targetChain: string,
    requiredAmount: number,
    tokenAddress: string,
    userAddress: string
  ): Promise<CombinationResult> {
    let totalAmount = 0;
    let totalFee = 0;
    const routes: BridgeRoute[] = [];

    const totalAvailable = sourceChains.reduce((sum, chain) => sum + chain.balance, 0);
    const remainingNeeded = requiredAmount;
    
    for (const sourceChain of sourceChains) {
      const proportion = sourceChain.balance / totalAvailable;
      const amountFromThisChain = Math.min(
        sourceChain.balance,
        remainingNeeded * proportion
      );

      if (amountFromThisChain >= 0.1) {
        try {
          const route = await this.calculateSingleSourceRoute(
            { ...sourceChain, balance: amountFromThisChain },
            targetChain,
            amountFromThisChain,
            tokenAddress,
            userAddress
          );

          routes.push(route);
          totalAmount += amountFromThisChain;
          totalFee += route.fee;
        } catch (error) {
          console.error(`Failed to get route from ${sourceChain.chain}:`, error);
        }
      }
    }

    return {
      chains: sourceChains.map(c => c.chain),
      totalAmount,
      totalFee,
      routes
    };
  }

  async findOptimalRoutes(
    balances: ChainBalance[],
    targetChain: string,
    requiredAmount: number,
    tokenAddress: string,
    userAddress: string
  ): Promise<RouteResponse> {
    const targetBalance = balances.find(b => b.chain === targetChain)?.balance || 0;
    const actuallyNeededAmount = Math.max(0, requiredAmount - targetBalance);
    
    if (actuallyNeededAmount <= 0) {
      return {
        routes: [],
        totalFee: 0,
        totalAmount: targetBalance,
        estimatedTotalTime: 0,
        availableBalance: balances.reduce((sum, b) => sum + b.balance, 0),
        requiredAmount,
        insufficientFunds: false,
        noValidRoutes: false,
        bridgeRoutes: []
      };
    }

    const sourceChains = balances.filter(b => b.chain !== targetChain && b.balance > 0);
    const combinations = this.getCombinations(sourceChains);
    
    let bestResult: CombinationResult | null = null;

    for (const combination of combinations) {
      const result = await this.evaluateCombination(
        combination,
        targetChain,
        actuallyNeededAmount,
        tokenAddress,
        userAddress
      );

      if (result.totalAmount >= actuallyNeededAmount) {
        if (!bestResult || result.totalFee < bestResult.totalFee) {
          bestResult = result;
        }
      }
    }

    if (!bestResult) {
      return {
        routes: [],
        totalFee: 0,
        totalAmount: targetBalance,
        estimatedTotalTime: 0,
        availableBalance: balances.reduce((sum, b) => sum + b.balance, 0),
        requiredAmount,
        insufficientFunds: true,
        noValidRoutes: true,
        bridgeRoutes: []
      };
    }

    const maxEstimatedTime = Math.max(...bestResult.routes.map(r => r.estimatedTime));

    return {
      routes: bestResult.routes,
      totalFee: bestResult.totalFee,
      totalAmount: targetBalance + bestResult.totalAmount,
      estimatedTotalTime: maxEstimatedTime,
      availableBalance: balances.reduce((sum, b) => sum + b.balance, 0),
      requiredAmount,
      insufficientFunds: false,
      noValidRoutes: false,
      bridgeRoutes: bestResult.routes.map(route => ({
        sourceChain: route.sourceChain,
        amount: route.amount,
        fee: route.fee,
        estimatedTime: route.estimatedTime,
        protocol: route.protocol,
        gasToken: route.gasToken
      }))
    };
  }
}
