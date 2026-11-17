import {
  IsDateString,
  IsIn,
  IsIP,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const DEVICE_STATUSES = ['online', 'offline', 'maintenance', 'attention'] as const;
export const EVENT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const EVENT_STATUSES = ['open', 'investigating', 'resolved', 'false_positive'] as const;
export const POLICY_STATUSES = ['draft', 'active', 'archived'] as const;
export const INCIDENT_STATUSES = ['open', 'investigating', 'contained', 'resolved', 'closed'] as const;

export class AuditActorHistoryQueryDto {
  @IsOptional()
  @IsUUID('4')
  cursor?: string;
}

export class CreateDeviceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/\S/)
  category!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/\S/)
  location!: string;

  @IsIP()
  ipAddress!: string;

  @IsOptional()
  @IsIn(DEVICE_STATUSES)
  status?: (typeof DEVICE_STATUSES)[number];
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/\S/)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/\S/)
  location?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @IsOptional()
  @IsIn(DEVICE_STATUSES)
  status?: (typeof DEVICE_STATUSES)[number];
}

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(/\S/)
  title!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/)
  source!: string;

  @IsIn(EVENT_SEVERITIES)
  severity!: (typeof EVENT_SEVERITIES)[number];

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: (typeof EVENT_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(/\S/)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/)
  source?: string;

  @IsOptional()
  @IsIn(EVENT_SEVERITIES)
  severity?: (typeof EVENT_SEVERITIES)[number];

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: (typeof EVENT_STATUSES)[number];
}

export class CreatePolicyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  @Matches(/\S/)
  summary!: string;

  @IsOptional()
  @IsIn(POLICY_STATUSES)
  status?: (typeof POLICY_STATUSES)[number];
}

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(/\S/)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  @Matches(/\S/)
  summary?: string;

  @IsOptional()
  @IsIn(POLICY_STATUSES)
  status?: (typeof POLICY_STATUSES)[number];
}

export class CreateIncidentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(/\S/)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  @Matches(/\S/)
  summary!: string;

  @IsIn(EVENT_SEVERITIES)
  severity!: (typeof EVENT_SEVERITIES)[number];

  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: (typeof INCIDENT_STATUSES)[number];
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(/\S/)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  @Matches(/\S/)
  summary?: string;

  @IsOptional()
  @IsIn(EVENT_SEVERITIES)
  severity?: (typeof EVENT_SEVERITIES)[number];

  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: (typeof INCIDENT_STATUSES)[number];
}
