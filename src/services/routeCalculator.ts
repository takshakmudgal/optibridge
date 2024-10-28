import { ChainBalance, BridgeRoute, RouteResponse } from "../types";
import { SocketApiService } from "./socketApi";
import { CHAIN_CONFIG } from "../config/chains";
import { BRIDGE_FEES } from "../config/bridgeFees";

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
    // Round to 6 decimal places to avoid floating point issues
    const neededAmount = Number(amount.toFixed(6));
    
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

    return {
      sourceChain: sourceChain.chain,
      amount: neededAmount,
      fee: totalFee > 0 ? totalFee : 0.000001,
      estimatedTime: bridgeFees.route.userTxs[0].estimatedTime,
      protocol: bridgeFees.route.userTxs[0].protocol || "unknown",
      gasToken: CHAIN_CONFIG[sourceChain.chain].nativeToken || "ETH",
      sourceBalance: sourceChain.balance,
    };
  }

  async findOptimalRoutes(
    balances: ChainBalance[],
    targetChain: string,
    requiredAmount: number,
    tokenAddress: string,
    userAddress: string
  ): Promise<RouteResponse> {
    // First, check target chain balance
    const targetBalance = balances.find(b => b.chain === targetChain)?.balance || 0;
    const actuallyNeededAmount = Math.max(0, requiredAmount - targetBalance);

    const sourceChains = balances
      .filter(b => b.chain !== targetChain && b.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const routes: BridgeRoute[] = [];
    let totalAmount = targetBalance; // Start with target chain balance
    let totalFee = 0;
    let maxEstimatedTime = 0;
    const availableBalance = balances.reduce((sum, b) => sum + b.balance, 0);

    // If we don't need to bridge anything, return early
    if (actuallyNeededAmount <= 0) {
      return {
        routes: [],
        totalFee: 0,
        totalAmount,
        estimatedTotalTime: 0,
        availableBalance,
        requiredAmount,
        insufficientFunds: false,
        noValidRoutes: false,
        bridgeRoutes: []
      };
    }

    // Check if we have enough funds in source chains
    const totalSourceFunds = sourceChains.reduce((sum, chain) => sum + chain.balance, 0);
    if (totalSourceFunds < actuallyNeededAmount) {
      return {
        routes: [],
        totalFee: 0,
        totalAmount: totalSourceFunds + targetBalance,
        estimatedTotalTime: 0,
        availableBalance,
        requiredAmount,
        insufficientFunds: true,
        noValidRoutes: false,
        bridgeRoutes: []
      };
    }

    let remainingAmount = actuallyNeededAmount;
    console.log(`Starting multi-chain route calculation with remaining amount: ${remainingAmount}`);

    for (const sourceChain of sourceChains) {
      if (remainingAmount <= 0) break;

      const amountFromThisChain = Math.min(sourceChain.balance, remainingAmount);
      if (amountFromThisChain < 0.1) continue; // Skip tiny amounts

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
        maxEstimatedTime = Math.max(maxEstimatedTime, route.estimatedTime);
        remainingAmount -= amountFromThisChain;

        console.log(`Added route from ${sourceChain.chain} for ${amountFromThisChain} USDC`);
        console.log(`Remaining amount needed: ${remainingAmount}`);
      } catch (error) {
        console.error(`Failed to get route from ${sourceChain.chain}:`, error);
        continue;
      }
    }

    return {
      routes,
      totalFee,
      totalAmount,
      estimatedTotalTime: maxEstimatedTime,
      availableBalance,
      requiredAmount,
      insufficientFunds: totalAmount < requiredAmount,
      noValidRoutes: routes.length === 0,
      bridgeRoutes: routes.map(route => ({
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
