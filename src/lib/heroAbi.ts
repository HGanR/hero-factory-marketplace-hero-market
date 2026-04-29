export const heroAbi = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "string",  name: "tokenURI", type: "string" }
    ],
    name: "mint",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function"
  }
] as const;
