import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found." });
});

// Postgres error codes that mean the caller sent a value the column cannot hold,
// not that the server is broken: out of range, bad text for a type, null violation.
const CLIENT_DATABASE_ERRORS = new Set(["22003", "22P02", "22001", "23502"]);

function databaseErrorCode(err: unknown): string | undefined {
  for (let current: unknown = err, depth = 0; current && typeof current === "object" && depth < 4; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

// Always JSON, never a stack trace and never SQL text.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = (err as { status?: unknown; statusCode?: unknown })?.status ?? (err as { statusCode?: unknown })?.statusCode;
  if ((err as { type?: unknown })?.type === "entity.parse.failed") {
    res.status(400).json({ error: "The request body is not valid JSON." });
    return;
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: status === 413 ? "The request body is too large." : "The request could not be read." });
    return;
  }
  const code = databaseErrorCode(err);
  if (code && CLIENT_DATABASE_ERRORS.has(code)) {
    req.log.warn({ code }, "Rejected a value the database cannot store");
    res.status(400).json({ error: "A value in the request is out of range or not valid for its field." });
    return;
  }
  req.log.error({ err }, "Unhandled request error");
  res.status(500).json({ error: "Something went wrong on the server." });
});

export default app;
