import { Injectable } from "@nestjs/common";
import type { CreateClientInput } from "@soie/contracts";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { TenantStore } from "../../common/tenant/tenant-context.js";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const { organizationId } = TenantStore.require();
    return this.prisma.forTenant(organizationId, (tx) =>
      tx.client.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }

  async create(input: CreateClientInput) {
    const { organizationId } = TenantStore.require();
    return this.prisma.forTenant(organizationId, (tx) =>
      tx.client.create({
        data: {
          organizationId,
          name: input.name,
          industry: input.industry,
          website: input.website,
          tags: input.tags,
        },
      }),
    );
  }
}
