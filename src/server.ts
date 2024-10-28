import { Elysia } from "elysia";
import { BridgeController } from "./controllers/bridgeController";
import { bridgeRequestSchema } from "./utils/validation";

const app = new Elysia();
const bridgeController = new BridgeController();

// bridgeController.setTestMode({
//   polygon: 50,
//   arbitrum: 100,
//   base: 80,
//   gnosis: 25,
//   blast: 30,
// });

app
  .post("/api/bridge/routes", async ({ body }) => {
    try {
      const validatedBody = bridgeRequestSchema.parse(body);
      const result = await bridgeController.getOptimalRoutes(validatedBody);
      return result;
    } catch (error: unknown) {
      console.error("API Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      const isValidationError =
        error instanceof Error && error.name === "ZodError";

      return {
        success: false,
        error: errorMessage,
        code: isValidationError ? "VALIDATION_ERROR" : "EXECUTION_ERROR",
        data: null,
      };
    }
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
