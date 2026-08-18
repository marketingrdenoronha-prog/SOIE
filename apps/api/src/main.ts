import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { env, logger } from "@soie/config";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: env.APP_URL, credentials: true });

  await app.listen(env.API_PORT);
  logger.info(`SOIE API listening on :${env.API_PORT} (prefix /api/v1)`);
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start API");
  process.exit(1);
});
