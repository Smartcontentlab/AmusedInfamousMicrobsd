import app from "./app";
import { recoverInterruptedTurns } from "./lib/arena-engine";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Turns cut off by the last shutdown would block their level forever, so settle them before serving.
try {
  const recovered = await recoverInterruptedTurns();
  if (recovered.turns > 0) logger.warn(recovered, "Marked turns left running by the last shutdown as failed");
} catch (err) {
  logger.error({ err }, "Could not recover interrupted arena turns");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
