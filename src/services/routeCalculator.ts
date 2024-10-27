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
    const bridgeFees = await this.socketApiService.getBridgeFees(
      sourceChain.chain,
      targetChain,
      amount.toString(),
      tokenAddress,
      userAddress
    );

    const bridgeFee = bridgeFees.route.userTxs[0].bridgeFee;
    const totalFee = bridgeFees.route.userTxs[0].gasFee + bridgeFee;

    return {
      sourceChain: sourceChain.chain,
      amount,
      fee: totalFee,
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
    console.log("Finding routes with balances:", {
      balances,
      targetChain,
      requiredAmount,
      tokenAddress,
    });

    const targetChainBalance =
      balances.find((b) => b.chain === targetChain)?.balance || 0;
    console.log("Target chain balance:", targetChainBalance);

    if (targetChainBalance >= requiredAmount) {
      return {
        routes: [
          {
            sourceChain: targetChain,
            amount: requiredAmount,
            fee: 0,
            estimatedTime: 0,
            protocol: "direct",
            gasToken: CHAIN_CONFIG[targetChain].nativeToken,
            sourceBalance: targetChainBalance,
          },
        ],
        totalFee: 0,
        totalAmount: requiredAmount,
        estimatedTotalTime: 0,
        availableBalance: targetChainBalance,
        requiredAmount,
        insufficientFunds: false,
        noValidRoutes: false,
        bridgeRoutes: [
          {
            sourceChain: targetChain,
            amount: requiredAmount,
            fee: 0,
            estimatedTime: 0,
            protocol: "direct",
            gasToken: CHAIN_CONFIG[targetChain].nativeToken,
          },
        ],
      };
    }

    const remainingRequired = Math.max(0, requiredAmount - targetChainBalance);

    const sourceChains = balances
      .filter((b) => {
        const isValid = b.chain !== targetChain && b.balance >= 0.1;
        console.log(
          `Chain ${b.chain} valid:`,
          isValid,
          "balance:",
          b.balance.toFixed(6)
        );
        return isValid;
      })
      .sort(
        (a, b) =>
          (BRIDGE_FEES[a.chain]?.[targetChain] || 0) -
          (BRIDGE_FEES[b.chain]?.[targetChain] || 0)
      );

    let remainingAmount = remainingRequired;
    const routes: BridgeRoute[] = [];
    let totalFee = 0;
    let maxEstimatedTime = 0;

    for (const sourceChain of sourceChains) {
      if (remainingAmount <= 0) break;

      try {
        const amountFromThisChain = Math.min(
          remainingAmount,
          sourceChain.balance
        );
        const route = await this.calculateSingleSourceRoute(
          sourceChain,
          targetChain,
          amountFromThisChain,
          tokenAddress,
          userAddress
        );

        console.log(`Calculated route from ${sourceChain.chain}:`, route);

        routes.push(route);
        totalFee += route.fee;
        remainingAmount -= amountFromThisChain;
        maxEstimatedTime = Math.max(maxEstimatedTime, route.estimatedTime || 0);
      } catch (error) {
        console.error(
          `Failed to get route from ${sourceChain.chain} to ${targetChain}:`,
          error
        );
        continue;
      }
    }

    const availableBalance = balances.reduce((sum, b) => sum + b.balance, 0);
    const totalAmount = requiredAmount - remainingAmount;

    return {
      routes,
      totalFee,
      totalAmount,
      estimatedTotalTime: maxEstimatedTime,
      availableBalance,
      requiredAmount,
      insufficientFunds: availableBalance < requiredAmount,
      noValidRoutes: routes.length === 0,
      bridgeRoutes: routes.map((route) => ({
        sourceChain: route.sourceChain,
        amount: route.amount,
        fee: route.fee,
        estimatedTime: route.estimatedTime,
        protocol: route.protocol,
        gasToken: route.gasToken,
      })),
    };
  }
}
