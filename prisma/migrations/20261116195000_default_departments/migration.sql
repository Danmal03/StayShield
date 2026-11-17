INSERT INTO "Department" ("id", "tenantId", "name", "description", "permissions", "updatedAt")
SELECT
    gen_random_uuid(),
    tenant."id",
    defaults."name",
    defaults."name" || ' department',
    ARRAY[
        'websiteAccessRequest',
        'deviceRegistration',
        'networkSupport',
        'accountAssistance',
        'lostDeviceReport',
        'securityReport',
        'supportRequest',
        'training'
    ]::TEXT[],
    CURRENT_TIMESTAMP
FROM "Tenant" AS tenant
CROSS JOIN (
    VALUES
        ('Reception'),
        ('Finance'),
        ('Human Resources'),
        ('Housekeeping'),
        ('Management'),
        ('Food and Beverage'),
        ('Maintenance'),
        ('IT')
) AS defaults("name")
ON CONFLICT ("tenantId", "name") DO NOTHING;
