import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDeviceDto, CreateEventDto } from '../src/operations/operations.dto';

describe('Operations request validation', () => {
  it('rejects malformed device addresses and unknown device statuses', async () => {
    const input = plainToInstance(CreateDeviceDto, {
      name: 'Lobby AP',
      category: 'Access point',
      location: 'Lobby',
      ipAddress: 'not-an-ip',
      status: 'compromised',
    });

    const errors = await validate(input);
    const invalidProperties = errors.map((error) => error.property);

    expect(invalidProperties).toContain('ipAddress');
    expect(invalidProperties).toContain('status');
  });

  it('rejects unknown event severity and triage states', async () => {
    const input = plainToInstance(CreateEventDto, {
      title: 'Unexpected login',
      description: '',
      source: 'Manual entry',
      severity: 'urgent',
      status: 'ignored',
    });

    const errors = await validate(input);
    const invalidProperties = errors.map((error) => error.property);

    expect(invalidProperties).toContain('severity');
    expect(invalidProperties).toContain('status');
  });
});
