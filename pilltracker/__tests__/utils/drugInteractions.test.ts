import {
  checkDrugInteractions,
  severityColor,
  severityLabel,
} from '../../utils/drugInteractions';

// ─── checkDrugInteractions ────────────────────────────────────────────────────

describe('checkDrugInteractions', () => {
  it('returns empty array when there are no existing medications', () => {
    const result = checkDrugInteractions('Warfarin 5mg', []);
    expect(result).toEqual([]);
  });

  it('returns empty array when no interaction exists', () => {
    const result = checkDrugInteractions('Vitamin C', ['Vitamin D']);
    expect(result).toEqual([]);
  });

  it('detects interaction when new med matches term A and existing matches term B', () => {
    // warfarin + aspirin is a HIGH interaction
    const result = checkDrugInteractions('Warfarin 5mg', ['Aspirin 81mg']);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('high');
    expect(result[0].drugs).toEqual(['warfarin', 'aspirin']);
  });

  it('detects interaction when new med matches term B and existing matches term A', () => {
    // Adding aspirin while warfarin already exists
    const result = checkDrugInteractions('Aspirin 81mg', ['Warfarin 5mg']);
    expect(result).toHaveLength(1);
    expect(result[0].drugs).toEqual(['warfarin', 'aspirin']);
  });

  it('is case-insensitive', () => {
    const result = checkDrugInteractions('WARFARIN', ['ASPIRIN']);
    expect(result).toHaveLength(1);
  });

  it('matches partial medication names', () => {
    // "Simvastatin 20mg" contains "simvastatin"
    const result = checkDrugInteractions('Simvastatin 20mg', ['Amiodarone 200mg']);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('high');
  });

  it('returns multiple interactions when several apply', () => {
    // warfarin interacts with aspirin AND ibuprofen
    const result = checkDrugInteractions('Warfarin 5mg', ['Aspirin 81mg', 'Ibuprofen 400mg']);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('deduplicates results — same interaction is not returned twice', () => {
    const result = checkDrugInteractions('Warfarin', ['Aspirin', 'Aspirin 81mg']);
    const key = (i: any) => `${i.drugs[0]}-${i.drugs[1]}`;
    const unique = new Set(result.map(key));
    expect(unique.size).toBe(result.length);
  });

  it('detects serotonin syndrome risk (fluoxetine + tramadol)', () => {
    const result = checkDrugInteractions('Tramadol 50mg', ['Fluoxetine 20mg']);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('high');
  });

  it('detects moderate interaction (metoprolol + diltiazem)', () => {
    const result = checkDrugInteractions('Metoprolol 25mg', ['Diltiazem 120mg']);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('moderate');
  });

  it('returns interaction description and recommendation', () => {
    const result = checkDrugInteractions('Warfarin', ['Aspirin']);
    expect(result[0].description).toBeTruthy();
    expect(result[0].recommendation).toBeTruthy();
  });

  it('returns empty array when new med does not match either drug in any pair', () => {
    const result = checkDrugInteractions('Paracetamol', ['Omeprazole']);
    expect(result).toEqual([]);
  });
});

// ─── severityColor ────────────────────────────────────────────────────────────

describe('severityColor', () => {
  it('returns red for high severity', () => {
    expect(severityColor('high')).toBe('#ef4444');
  });

  it('returns amber for moderate severity', () => {
    expect(severityColor('moderate')).toBe('#f59e0b');
  });

  it('returns blue for low severity', () => {
    expect(severityColor('low')).toBe('#3b82f6');
  });
});

// ─── severityLabel ────────────────────────────────────────────────────────────

describe('severityLabel', () => {
  it('returns HIGH for high severity', () => {
    expect(severityLabel('high')).toBe('HIGH');
  });

  it('returns MODERATE for moderate severity', () => {
    expect(severityLabel('moderate')).toBe('MODERATE');
  });

  it('returns LOW for low severity', () => {
    expect(severityLabel('low')).toBe('LOW');
  });
});
