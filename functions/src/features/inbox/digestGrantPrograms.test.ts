import {describe, expect, it} from 'vitest';
import {grantDetailsHtml, type GrantProgramDetailConfig} from './digestGrantPrograms';

const allOn: GrantProgramDetailConfig = {
  showDescription: true,
  showEligibility: true,
  showCodes: true,
  showServices: true,
  showDates: true,
  showDuration: true,
};

describe('grant/program digest details', () => {
  const grants = [{id: 'g1', data: {
    name: 'Housing Program',
    description: 'Housing support',
    eligibility: {Income: 'Below limit'},
    servicesOffered: ['Rent', 'Deposit'],
    invoicing: {grantCode: 'G-10', programCode: 'FE-2', hmisCode: 'HMIS-4'},
  }}];

  it('renders configured descriptive fields and labeled codes', () => {
    const html = grantDetailsHtml(grants, allOn);
    expect(html).toContain('Housing support');
    expect(html).toContain('Eligibility');
    expect(html).toContain('Grant code');
    expect(html).toContain('G-10');
    expect(html).toContain('Services provided');
  });

  it('omits disabled detail groups', () => {
    const html = grantDetailsHtml(grants, {...allOn, showDescription: false, showEligibility: false, showCodes: false});
    expect(html).not.toContain('Housing support');
    expect(html).not.toContain('Below limit');
    expect(html).not.toContain('G-10');
  });
});
