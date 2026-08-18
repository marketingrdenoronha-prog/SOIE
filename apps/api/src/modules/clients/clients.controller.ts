import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { createClientInput } from "@soie/contracts";
import { ClientsService } from "./clients.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";

@Controller("clients")
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list() {
    return this.clients.list();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.clients.create(createClientInput.parse(body));
  }
}
