import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { IS_PUBLIC, REQUIRED_ROLES } from './auth.constants';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC, true);

export const Roles = (...roles: SystemRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES, roles);
