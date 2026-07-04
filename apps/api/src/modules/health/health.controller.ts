import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(): Promise<{ status: string; db: boolean }> {
    let db = false;
    try {
      await this.prisma.client.$queryRawUnsafe("SELECT 1");
      db = true;
    } catch {
      db = false;
    }
    return { status: db ? "ok" : "degraded", db };
  }
}
