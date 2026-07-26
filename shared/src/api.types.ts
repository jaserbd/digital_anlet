import type { Role } from './enums';

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
}
