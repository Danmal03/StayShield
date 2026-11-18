import {
  IsDateString,
  IsEmail,
  IsIn,
  IsIP,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const networkSources = ['wifi_controller', 'radius', 'nac', 'endpoint_agent', 'simulation'] as const;
export const connectionTypes = ['wifi', 'ethernet', 'cellular', 'unknown'] as const;
export const networkEventTypes = ['connected', 'update', 'disconnected'] as const;

export class CreateNetworkIntegrationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsIn(networkSources)
  source!: typeof networkSources[number];
}

export class NetworkProviderEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  sourceSessionId!: string;

  @IsIn(networkEventTypes)
  eventType!: typeof networkEventTypes[number];

  @IsIn(connectionTypes)
  connectionType!: typeof connectionTypes[number];

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  employeeEmail?: string;

  @IsOptional()
  @IsUUID('4')
  registeredDeviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ssid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  carrierName?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  networkSegment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  accessPoint?: string;

  @IsOptional()
  @IsIn(['protected', 'at_risk', 'unverified', 'not_available'])
  securityStatus?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
