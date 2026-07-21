import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ControlsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.control.findMany({
      orderBy: { number: 'asc' },
      include: { safeguards: { orderBy: { code: 'asc' } } },
    });
  }

  findOne(number: number) {
    return this.prisma.control.findFirst({
      where: { number },
      include: { safeguards: { orderBy: { code: 'asc' } } },
    });
  }
}
