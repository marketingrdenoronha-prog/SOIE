import { Module } from "@nestjs/common";
import { DeliverablesController } from "./deliverables.controller.js";
import { DeliverablesService } from "./deliverables.service.js";
import { PublicReviewController } from "../review/public-review.controller.js";
import { PublicReviewService } from "../review/public-review.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";

@Module({
  controllers: [DeliverablesController, PublicReviewController],
  providers: [DeliverablesService, PublicReviewService, PrismaService],
})
export class DeliverablesModule {}
