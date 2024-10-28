export const BRIDGE_FEES: Record<string, Record<string, number>> = {
  arbitrum: {
    polygon: 1.5,
    blast: 2.1,
    base: 1.8,
    gnosis: 1.9
  },
  base: {
    polygon: 0.8,
    blast: 1.2,
    arbitrum: 1.1,
    gnosis: 0.9
  },
  gnosis: {
    polygon: 0.3,
    blast: 0.5,
    arbitrum: 0.4,
    base: 0.35
  },
  blast: {
    polygon: 0.6,
    arbitrum: 0.9,
    base: 0.7,
    gnosis: 0.8
  },
  polygon: {
    arbitrum: 0.7,
    base: 0.6,
    gnosis: 0.4,
    blast: 1.0 // Higher fee for Blast as it's a newer chain
  }
};

export const GAS_MULTIPLIERS: Record<string, number> = {
  arbitrum: 1.2,  // Higher gas costs on Arbitrum
  base: 1.1,
  gnosis: 0.8,    // Lower gas costs on Gnosis
  blast: 1.3,     // Higher gas costs on Blast
  polygon: 0.9    // Lower gas costs on Polygon
};

export const BASE_GAS_FEE = 0.001; // Base gas fee in USDC
