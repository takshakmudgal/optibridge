export interface ChainConfig {
  name: string;
  chainId: number;
  nativeToken: string;
  usdcAddress: string;
  rpcUrl: string;
}

export const CHAIN_CONFIG: { [key: string]: ChainConfig } = {
  polygon: {
    name: "Polygon",
    chainId: 137,
    nativeToken: "MATIC",
    usdcAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    rpcUrl: "https://polygon.llamarpc.com",
  },
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    nativeToken: "ETH",
    usdcAddress: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    rpcUrl: "https://arbitrum.llamarpc.com",
  },
  base: {
    name: "Base",
    chainId: 8453,
    nativeToken: "ETH",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    rpcUrl: "https://base.llamarpc.com",
  },
  gnosis: {
    name: "Gnosis",
    chainId: 100,
    nativeToken: "xDAI",
    usdcAddress: "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83",
    rpcUrl: "https://gnosis.drpc.org",
  },
  blast: {
    name: "Blast",
    chainId: 81457,
    nativeToken: "ETH",
    usdcAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    rpcUrl: "https://blast.blockpi.network/v1/rpc/public",
  },
};
