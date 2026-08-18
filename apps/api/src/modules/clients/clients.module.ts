import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller.js";
import { ClientsService } from "./clients.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, PrismaService],
})
export class ClientsModule {}
