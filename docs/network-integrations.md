# StayShield network connection integrations

StayShield does not read Wi-Fi SSIDs from browser JavaScript. Staff connection details are available only after an authorised provider sends events to the API. No provider is connected by default, and the dashboard does not create simulated sessions.

## Configure a provider

1. Sign in as a system owner, security administrator, or network administrator.
2. Open **Administration → Network monitoring** and create a named integration for a Wi-Fi controller, RADIUS accounting system, NAC, or managed endpoint connector.
3. Copy the generated Bearer credential immediately. StayShield stores only its SHA-256 hash and does not display the credential again.
4. Configure the trusted provider-side connector to send normalized JSON events to `POST /api/network-provider/events` over HTTPS with `Authorization: Bearer <credential>`.
5. Send periodic `update` events often enough to meet the freshness window. The default is 300 seconds; set `NETWORK_SESSION_FRESHNESS_SECONDS` to an integer from 30 to 3600 to change it.

Creating an integration only provisions an API credential. It does not configure or connect a controller, RADIUS server, NAC, or endpoint agent. Provider-specific API clients and OS-native agents must be deployed and tested by the hotel before the source can report real data.

For development testing only, choose **Simulation (development only)**. Simulation credentials and their events are rejected unless the API runs with `NODE_ENV=development`; simulated connections are visibly labelled in employee and administrator views. StayShield does not create sample sessions automatically. Do not configure this source in production.

## Event contract

Each event represents one provider session. Keep `sourceSessionId` stable for that connection; use a new value when the device changes networks. Send `connected`, periodic `update`, and `disconnected` events. `occurredAt` should be the provider event time in ISO 8601 format. `registeredDeviceId`, when used, must be the StayShield UUID of an approved registered employee device.

Example request (illustrative payload only; it is not seeded or treated as a real connection):

```http
POST /api/network-provider/events
Authorization: Bearer <credential>
Content-Type: application/json
```

```json
{
  "sourceSessionId": "provider-session-123",
  "eventType": "connected",
  "connectionType": "wifi",
  "employeeEmail": "employee@example.test",
  "registeredDeviceId": "00000000-0000-4000-8000-000000000001",
  "ssid": "Example-Staff-WiFi",
  "ipAddress": "192.0.2.15",
  "networkSegment": "staff",
  "accessPoint": "AP-12",
  "securityStatus": "not_available",
  "occurredAt": "2026-11-18T07:00:00.000Z"
}
```

Supported `connectionType` values are `wifi`, `ethernet`, `cellular`, and `unknown`. A Wi-Fi SSID is accepted only for `wifi`; carrier names are accepted only for `cellular`. Do not send passwords, MAC addresses, browsing contents, or other unnecessary identifiers. Security status must come from the provider and is not inferred by StayShield.

## Identity and privacy

The provider credential scopes events to its configured tenant. Employee email and registered device identifiers are resolved server-side within that tenant. If both are supplied and do not resolve to the same active employee, the connection is stored as **unverified**, with no employee or device association. Unknown identity is never guessed from an IP address.

Staff APIs derive ownership from the authenticated StayShield session and do not accept employee IDs. They return only verified records for that employee. Administrators with an authorised role can review tenant sessions, including records labelled **Device identity not verified**. Disabling an integration stops acceptance of new events; it does not erase historical records.

The current-connection endpoint treats provider updates older than the configured freshness window as unverified and omits the prior SSID/IP from the current view. Historical records remain visible only in the employee’s own history or the authorised administrator view.

## API endpoints

- `GET /api/staff-portal/network/current` — authenticated employee’s current verified connection.
- `GET /api/staff-portal/network/history` — up to 50 of that employee’s verified connection records.
- `GET /api/staff-portal/network/status` — provider configuration and freshness, without connection details.
- `GET /api/staff-portal/network/admin/sessions` — authorized tenant-wide recent sessions.
- `GET /api/staff-portal/network/admin/integrations` — authorized integration status.
- `POST /api/staff-portal/network/admin/integrations` — create a provider credential; returned once.
- `DELETE /api/staff-portal/network/admin/integrations/:id` — disable a tenant-owned integration.
- `POST /api/network-provider/events` — token-authenticated provider event ingestion.

Use HTTPS, protect provider credentials as secrets, and restrict provider egress to the StayShield API. Validate the integration against the actual controller/RADIUS/NAC/MDM system before relying on its SSID, IP, segment, or security-status claims.
