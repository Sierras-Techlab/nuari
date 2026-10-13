import { Controller, Get } from '@nestjs/common';
import { PlanCode } from '../generated/prisma/client.js';

@Controller('subscription-plans')
export class SubscriptionsController {
  @Get()
  plans() { return { plans: Object.values(PlanCode).map(code => ({ code })), trialDays: 14 }; }
}
