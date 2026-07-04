import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";

@Module({
  controllers: [AiController],
  providers: [AiService, PrismaService],
})
export class AiModule {}
