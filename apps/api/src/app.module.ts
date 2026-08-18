import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { RequestContextMiddleware } from "./common/tenant/request-context.middleware.js";
import { HealthModule } from "./modules/health/health.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ClientsModule } from "./modules/clients/clients.module.js";
import { AiModule } from "./modules/ai/ai.module.js";
import { DeliverablesModule } from "./modules/deliverables/deliverables.module.js";

@Module({
  imports: [HealthModule, AuthModule, ClientsModule, AiModule, DeliverablesModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
