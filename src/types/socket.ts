export interface SocketQuoteResponse {
  success: boolean;
  result: {
    routes: Array<{
      routeId: string;
      fromAmount: string;
      toAmount: string;
      totalGasFeeUSD: string;
      totalBridgeFeeUSD?: string;
      protocol?: string;
      serviceTime: number;
      userTxs: Array<{
        userTxType: string;
        gasFeeUSD: string;
        approvalData: null | {
          minimumApprovalAmount: string;
          approvalTokenAddress: string;
          allowanceTarget: string;
        };
      }>;
    }>;
  };
}
