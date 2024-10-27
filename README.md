# optibridge

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-4.5.4-blue.svg)
![Redis](https://img.shields.io/badge/redis-6.2.5-blue.svg)
![Bun](https://img.shields.io/badge/bun-v0.1.13-blue.svg)

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
  - [Running the Application](#running-the-application)
  - [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Running with Docker](#running-with-docker)

## Introduction

Welcome to the **optibridge** project! This backend service is designed to facilitate optimal cross-chain token bridging by calculating the most efficient routes based on user requests. Leveraging multiple blockchain networks, the service ensures minimal fees and optimal transaction times, providing a seamless bridging experience for users.

## Features

- **Optimal Route Calculation:** Determines the best possible paths for token bridging across supported blockchain networks.
- **Dynamic Fee Management:** Integrates with external APIs to fetch real-time bridge fees and applies fallback mechanisms when necessary.
- **Caching with Redis:** Implements caching strategies to enhance performance and reduce redundant API calls.
- **Robust Error Handling:** Comprehensive error management to handle various failure scenarios gracefully.
- **Test Mode:** Allows simulation of different blockchain balances for testing purposes without interacting with actual networks.
- **Scalable Architecture:** Built with scalability in mind, accommodating the addition of more blockchain networks with ease.

## Technology Stack

- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Runtime:** [Bun](https://bun.sh/)
- **Framework:** [Elysia](https://github.com/elysiaJS/elysia)
- **Caching:** [Redis](https://redis.io/)
- **Blockchain Interaction:** [Ethers.js](https://docs.ethers.io/v5/)
- **Validation:** [Zod](https://github.com/colinhacks/zod)
- **HTTP Client:** [Axios](https://axios-http.com/)

## Getting Started

### Prerequisites

Ensure you have the following installed on your system:

- [Bun](https://bun.sh/) (v0.1.13)
- [Redis](https://redis.io/) (v6.2.5)

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/takshakmudgal/optibridge.git
   cd optibridge
   ```

2. **Install Dependencies**

   Using Bun:

   ```bash
   bun install
   ```

### Configuration

1. **Environment Variables**

   Create a `.env` file in the root directory and populate it with the required environment variables:

   ```env
   SOCKET_API_KEY=your_socket_api_key
   REDIS_URL=redis://localhost:6379
   PORT=3000
   ```

   - `SOCKET_API_KEY`: Your API key for the Socket API service.
   - `REDIS_URL`: Connection URL for your Redis instance.
   - `PORT`: Port on which the application will run (default is 3000).

2. **Supported Chains Configuration**

   The application supports multiple blockchain networks. You can configure supported chains in the `src/config/chains.ts` file. Each chain configuration includes:

   - `name`: Human-readable name of the chain.
   - `chainId`: Unique identifier for the blockchain.
   - `nativeToken`: The native cryptocurrency of the chain.
   - `usdcAddress`: Contract address for USDC on the chain.
   - `rpcUrl`: RPC endpoint for interacting with the blockchain.

3. **Bridge Fees Configuration**

   Bridge fees between chains are defined in `src/config/bridgeFees.ts`. You can adjust the fees as needed:

   ```typescript
   export const BRIDGE_FEES: Record<string, Record<string, number>> = {
     arbitrum: {
       polygon: 1,
     },
     base: {
       polygon: 0.5,
     },
     gnosis: {
       polygon: 0.1,
     },
     blast: {
       polygon: 0.2,
     },
   };
   ```

## Usage

### Running the Application

Start the development server using Bun:

```bash
bun run dev
```

The server will start on the specified port (default: 3000). You should see a console message indicating that Elysia is running:

```
🦊 Elysia is running at localhost:3000
```

### API Endpoints

#### `POST /api/bridge/routes`

Calculates the optimal bridging routes based on the user's request.

- **Request Body**

  ```json
  {
    "targetChain": "string",      // The blockchain network to bridge to (e.g., "polygon")
    "amount": number,             // The amount of tokens to bridge
    "tokenAddress": "string",     // The contract address of the token to bridge
    "userAddress": "string"       // The user's wallet address initiating the bridge
  }
  ```

  - **Validation Rules:**
    - `targetChain`: Must be a supported chain.
    - `amount`: Must be a positive number.
    - `tokenAddress` & `userAddress`: Must be valid Ethereum addresses (42 characters, starting with `0x`).

- **Response**

  - **Success**

    ```json
    {
      "success": true,
      "data": {
        "routes": [
          {
            "sourceChain": "string",
            "amount": number,
            "fee": number,
            "estimatedTime": number,
            "protocol": "string",
            "gasToken": "string",
            "sourceBalance": number
          }
        ],
        "totalFee": number,
        "totalAmount": number,
        "estimatedTotalTime": number,
        "availableBalance": number,
        "requiredAmount": number,
        "insufficientFunds": false,
        "noValidRoutes": false,
        "bridgeRoutes": [
          {
            "sourceChain": "string",
            "amount": number,
            "fee": number,
            "estimatedTime": number,
            "protocol": "string",
            "gasToken": "string"
          }
        ],
        "targetChain": "string",
        "shortfall": number
      },
      "error": null
    }
    ```

  - **Failure**

    ```json
    {
      "success": false,
      "error": "Error message detailing the issue",
      "data": {
        "routes": [],
        "totalFee": 0,
        "totalAmount": 0,
        "estimatedTotalTime": 0,
        "availableBalance": 0,
        "requiredAmount": number,
        "insufficientFunds": true,
        "noValidRoutes": true,
        "bridgeRoutes": [],
        "targetChain": "string",
        "shortfall": number
      }
    }
    ```

- **Example Request**

  ```bash
  curl -X POST http://localhost:3000/api/bridge/routes \
    -H "Content-Type: application/json" \
    -d '{
          "targetChain": "arbitrum",
          "amount": 100,
          "tokenAddress": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
          "userAddress": "0xYourEthereumAddressHere"
        }'
  ```

## Project Structure

```
optibridge/
├── src/
│   ├── config/
│   │   ├── bridgeFees.ts
│   │   ├── chains.ts
│   │   ├── env.ts
│   │   └── redis.ts
│   ├── controllers/
│   │   └── bridgeController.ts
│   ├── services/
│   │   ├── routeCalculator.ts
│   │   └── socketApi.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── socket.ts
│   ├── utils/
│   │   ├── errors.ts
│   │   └── validation.ts
│   └── server.ts
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

- **src/config/**: Contains configuration files for environment variables, Redis, supported chains, and bridge fees.
- **src/controllers/**: Handles incoming API requests and orchestrates responses.
- **src/services/**: Contains business logic for route calculation and external API interactions.
- **src/types/**: Defines TypeScript interfaces and types used throughout the application.
- **src/utils/**: Utility functions and custom error classes.
- **src/server.ts**: Entry point of the application, sets up the Elysia server and routes.

## Contributing

Contributions are welcome! Please follow these steps to contribute:

1. **Fork the Repository**

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/YourFeatureName
   ```

3. **Commit Your Changes**

   ```bash
   git commit -m "Add your message here"
   ```

4. **Push to the Branch**

   ```bash
   git push origin feature/YourFeatureName
   ```

5. **Open a Pull Request**

Please ensure your code adheres to the project's coding standards and passes all existing tests.

## Running with Docker

To run **optibridge** using Docker, follow these steps:

### Prerequisites

- [Docker](https://www.docker.com/get-started) installed on your system.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

### Steps

1. **Clone the Repository**

   ```bash
   git clone https://github.com/takshakmudgal/optibridge.git
   cd optibridge
   ```

2. **Create a `.env` File**

   Create a `.env` file in the root directory and add your environment variables:

   ```env
   SOCKET_API_KEY=your_socket_api_key
   PORT=3000
   ```

3. **Build and Run with Docker Compose**

   ```bash
   docker-compose up --build
   ```

   This command will build the Docker image and start both the application and Redis services. The application will be accessible at [http://localhost:3000](http://localhost:3000).

4. **Stopping the Services**

   To stop the services, press `Ctrl + C` in the terminal where Docker Compose is running, then execute:

   ```bash
   docker-compose down
   ```

### Notes

- The application code is mounted into the Docker container, allowing for live-reloading during development.
- Redis data is persisted using Docker volumes to prevent data loss between restarts.

## License

This project is licensed under the [MIT License](LICENSE). See the [LICENSE](LICENSE) file for details.
