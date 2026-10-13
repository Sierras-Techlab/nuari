import { Controller, Get } from '@nestjs/common';
import { Public } from './identity/public.decorator.js';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
