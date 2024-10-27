export interface ChainBalance {
  chain: string;
  balance: number;
  bridgeFee: number;
  bridgeTime?: number; // in seconds
}

export interface BridgeRoute {
  sourceChain: string;
  amount: number;
  fee: number;
  estimatedTime: number;
  protocol?: string;
  gasToken?: string;
  sourceBalance: number;
}

export interface RouteResponse {
  routes: BridgeRoute[];
  totalFee: number;
  totalAmount: number;
  estimatedTotalTime: number;
  availableBalance: number;
  requiredAmount: number;
  insufficientFunds: boolean;
  noValidRoutes: boolean;
  bridgeRoutes: {
    sourceChain: string;
    amount: number;
    fee: number;
    estimatedTime: number;
    protocol?: string;
    gasToken?: string;
  }[];
}

export interface BridgeRequest {
  targetChain: string;
  amount: number;
  tokenAddress: string;
  userAddress: string;
}
