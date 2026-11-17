# Security policy

## Reporting a vulnerability

Do not disclose vulnerabilities publicly or include real hotel, guest, staff, tenant, or credential data in a report. Contact the system owner through the organisation's approved security reporting channel. Include affected versions, reproducible steps using synthetic data, and a suggested impact assessment.

## Security boundaries

StayShield is intended for authorised defensive administration. Do not connect this project to a live hotel network, endpoint fleet, or Microsoft tenant without written authorisation, approved least-privilege scopes, and an agreed privacy/legal basis.

Never submit secrets, production logs, personal data, or mailbox contents to development issues or test fixtures. Report security issues affecting authentication, tenant isolation, role enforcement, exports, evidence, or monitoring privacy as high priority.

## Current status

The repository is an early scaffold and has not completed security review or production hardening. Do not deploy it to production. MFA, SSO, tenant provisioning controls, privacy/retention workflows, operational modules, and dedicated security tests remain incomplete.
