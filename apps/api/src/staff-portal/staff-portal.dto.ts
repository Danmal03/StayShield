import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const requestCategories = [
  'website_access',
  'device_registration',
  'network_connectivity',
  'account_assistance',
  'lost_device',
  'security_incident',
  'suspicious_email',
  'suspected_malware',
  'suspicious_device',
  'general_it_support',
] as const;

const departmentPermissions = [
  'websiteAccessRequest',
  'deviceRegistration',
  'networkSupport',
  'accountAssistance',
  'lostDeviceReport',
  'securityReport',
  'supportRequest',
  'training',
] as const;

export class UpdateStaffProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, unknown>;
}

export class CreatePersonalDeviceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  deviceType!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  operatingSystem!: string;
}

export class CreateStaffRequestDto {
  @IsIn([...requestCategories])
  category!: (typeof requestCategories)[number];

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  websiteCategory?: string;

  @IsOptional()
  @IsDateString()
  temporaryUntil?: string;
}

export class CreateSecurityReportDto {
  @IsIn(['security_incident', 'suspicious_email', 'suspected_malware', 'suspicious_device'])
  category!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  description!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class UpdateStaffRequestDto {
  @IsIn(['in_progress', 'approved', 'declined', 'resolved'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminResponse?: string;
}

export class DepartmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMaxSize(departmentPermissions.length)
  @IsIn([...departmentPermissions], { each: true })
  permissions!: (typeof departmentPermissions)[number][];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsUUID('4')
  audienceDepartmentId?: string;
}

export class TrainingQuestionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  prompt!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  answerIndex!: number;
}

export class CreateTrainingCourseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  summary!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(10000)
  content!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TrainingQuestionDto)
  questions!: TrainingQuestionDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class AssignTrainingDto {
  @IsUUID('4')
  userId!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class ReviewPersonalDeviceDto {
  @IsIn(['approved', 'declined'])
  status!: 'approved' | 'declined';
}

export class AssignDepartmentDto {
  @IsOptional()
  @IsUUID('4')
  departmentId?: string | null;
}

export class SubmitTrainingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(5, { each: true })
  answers!: number[];
}
