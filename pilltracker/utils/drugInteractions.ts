// ─── Drug Interaction Database ─────────────────────────────────────────────────
// A curated list of clinically significant drug–drug interactions.
// Source references: FDA drug interaction data, clinical pharmacology guidelines.

export type Severity = 'high' | 'moderate' | 'low';

export interface DrugInteraction {
  drugs: [string, string];   // canonical lowercase names to match against
  severity: Severity;
  description: string;
  recommendation: string;
}

// Each entry uses lowercase search terms. Matching is done with .includes()
// so partial names like "warfarin" will match "Warfarin 5mg".
const INTERACTION_DB: DrugInteraction[] = [
  // ── Blood thinners ──────────────────────────────────────────────────────────
  {
    drugs: ['warfarin', 'aspirin'],
    severity: 'high',
    description: 'Combining warfarin and aspirin significantly increases the risk of serious bleeding, including gastrointestinal and intracranial hemorrhage.',
    recommendation: 'Use together only under close medical supervision with frequent INR monitoring.',
  },
  {
    drugs: ['warfarin', 'ibuprofen'],
    severity: 'high',
    description: 'Ibuprofen (an NSAID) can displace warfarin from plasma proteins and inhibit platelet aggregation, greatly increasing bleeding risk.',
    recommendation: 'Avoid co-administration. Use acetaminophen for pain relief if anticoagulation is required.',
  },
  {
    drugs: ['warfarin', 'naproxen'],
    severity: 'high',
    description: 'Naproxen can enhance the anticoagulant effect of warfarin, increasing bleeding risk.',
    recommendation: 'Avoid. Use acetaminophen instead. Monitor INR closely if use is unavoidable.',
  },
  {
    drugs: ['warfarin', 'fluconazole'],
    severity: 'high',
    description: 'Fluconazole inhibits CYP2C9, the primary enzyme that metabolizes warfarin, leading to dramatically increased warfarin levels and bleeding risk.',
    recommendation: 'Reduce warfarin dose and monitor INR frequently during and after fluconazole therapy.',
  },
  {
    drugs: ['clopidogrel', 'omeprazole'],
    severity: 'moderate',
    description: 'Omeprazole inhibits CYP2C19, which is needed to convert clopidogrel to its active form, reducing its antiplatelet effectiveness.',
    recommendation: 'Consider using pantoprazole instead of omeprazole if a PPI is needed.',
  },

  // ── Statins ─────────────────────────────────────────────────────────────────
  {
    drugs: ['simvastatin', 'amiodarone'],
    severity: 'high',
    description: 'Amiodarone inhibits CYP3A4, raising simvastatin blood levels significantly and increasing the risk of myopathy and rhabdomyolysis.',
    recommendation: 'Limit simvastatin dose to 20mg/day or switch to a statin less affected by CYP3A4 (e.g., rosuvastatin, pravastatin).',
  },
  {
    drugs: ['simvastatin', 'erythromycin'],
    severity: 'high',
    description: 'Erythromycin is a strong CYP3A4 inhibitor that can markedly increase simvastatin plasma concentrations, raising rhabdomyolysis risk.',
    recommendation: 'Temporarily suspend simvastatin during erythromycin course.',
  },
  {
    drugs: ['simvastatin', 'clarithromycin'],
    severity: 'high',
    description: 'Clarithromycin strongly inhibits CYP3A4, causing dangerous simvastatin accumulation and risk of severe muscle damage.',
    recommendation: 'Temporarily suspend simvastatin during clarithromycin therapy.',
  },
  {
    drugs: ['lovastatin', 'erythromycin'],
    severity: 'high',
    description: 'Erythromycin inhibits the metabolism of lovastatin, greatly increasing myopathy risk.',
    recommendation: 'Temporarily suspend lovastatin during erythromycin course.',
  },

  // ── Serotonergic drugs ───────────────────────────────────────────────────────
  {
    drugs: ['fluoxetine', 'tramadol'],
    severity: 'high',
    description: 'Both drugs increase serotonin levels. Combined use can cause serotonin syndrome — a potentially life-threatening condition with agitation, tachycardia, and hyperthermia.',
    recommendation: 'Avoid this combination. If pain management is needed, consult prescriber for a non-serotonergic alternative.',
  },
  {
    drugs: ['sertraline', 'tramadol'],
    severity: 'high',
    description: 'Sertraline and tramadol together risk serotonin syndrome. Tramadol also lowers the seizure threshold, which SSRIs can compound.',
    recommendation: 'Avoid if possible. Discuss alternatives with your doctor.',
  },
  {
    drugs: ['paroxetine', 'tramadol'],
    severity: 'high',
    description: 'Paroxetine inhibits CYP2D6 (needed to activate tramadol) and increases serotonin activity, raising risk of serotonin syndrome.',
    recommendation: 'Avoid co-administration. Consult prescriber.',
  },
  {
    drugs: ['linezolid', 'fluoxetine'],
    severity: 'high',
    description: 'Linezolid is a weak MAO inhibitor. Combined with an SSRI it can precipitate serotonin syndrome.',
    recommendation: 'Do not use concurrently. Allow a washout period.',
  },

  // ── Cardiac drugs ────────────────────────────────────────────────────────────
  {
    drugs: ['digoxin', 'amiodarone'],
    severity: 'high',
    description: 'Amiodarone inhibits P-glycoprotein and slows digoxin clearance, causing digoxin toxicity (nausea, vision changes, arrhythmias).',
    recommendation: 'Reduce digoxin dose by 30–50% when amiodarone is started. Monitor digoxin levels closely.',
  },
  {
    drugs: ['metoprolol', 'verapamil'],
    severity: 'high',
    description: 'Combining a beta-blocker (metoprolol) with a calcium channel blocker (verapamil) can cause severe bradycardia, AV block, and heart failure.',
    recommendation: 'Avoid intravenous administration together. Use with extreme caution orally under cardiac monitoring.',
  },
  {
    drugs: ['metoprolol', 'diltiazem'],
    severity: 'moderate',
    description: 'Diltiazem inhibits CYP2D6, increasing metoprolol levels and risk of bradycardia and hypotension.',
    recommendation: 'Monitor heart rate and blood pressure. Dose adjustment may be needed.',
  },

  // ── ACE inhibitors / potassium ───────────────────────────────────────────────
  {
    drugs: ['lisinopril', 'potassium'],
    severity: 'moderate',
    description: 'ACE inhibitors like lisinopril can raise serum potassium levels. Adding potassium supplements increases the risk of hyperkalemia (dangerously high potassium).',
    recommendation: 'Monitor serum potassium regularly. Avoid potassium supplements unless directed by a physician.',
  },
  {
    drugs: ['enalapril', 'potassium'],
    severity: 'moderate',
    description: 'Enalapril (ACE inhibitor) combined with potassium supplements can cause hyperkalemia.',
    recommendation: 'Monitor serum potassium levels regularly.',
  },

  // ── Lithium interactions ─────────────────────────────────────────────────────
  {
    drugs: ['lithium', 'ibuprofen'],
    severity: 'high',
    description: 'NSAIDs like ibuprofen reduce renal lithium excretion, causing lithium toxicity (tremor, confusion, cardiac arrhythmias).',
    recommendation: 'Avoid NSAIDs with lithium. Use acetaminophen for pain. Monitor lithium levels if NSAID is necessary.',
  },
  {
    drugs: ['lithium', 'naproxen'],
    severity: 'high',
    description: 'Naproxen reduces renal clearance of lithium, leading to toxic lithium accumulation.',
    recommendation: 'Avoid. Use acetaminophen. Monitor lithium serum levels closely.',
  },

  // ── Antibiotics and absorption ───────────────────────────────────────────────
  {
    drugs: ['ciprofloxacin', 'antacid'],
    severity: 'moderate',
    description: 'Antacids containing aluminum or magnesium form insoluble complexes with ciprofloxacin, reducing its absorption and effectiveness.',
    recommendation: 'Take ciprofloxacin at least 2 hours before or 6 hours after antacids.',
  },
  {
    drugs: ['doxycycline', 'antacid'],
    severity: 'moderate',
    description: 'Divalent cations in antacids chelate doxycycline, reducing its absorption significantly.',
    recommendation: 'Separate doses by at least 2 hours.',
  },
  {
    drugs: ['metronidazole', 'alcohol'],
    severity: 'high',
    description: 'Metronidazole inhibits aldehyde dehydrogenase, causing a disulfiram-like reaction with alcohol: flushing, nausea, vomiting, headache.',
    recommendation: 'Avoid all alcohol during metronidazole treatment and for 48 hours after the last dose.',
  },

  // ── Anticoagulants ───────────────────────────────────────────────────────────
  {
    drugs: ['rivaroxaban', 'aspirin'],
    severity: 'high',
    description: 'Both agents inhibit coagulation pathways through different mechanisms. Combined use substantially increases bleeding risk.',
    recommendation: 'Only use together if explicitly prescribed. Monitor for signs of bleeding.',
  },
  {
    drugs: ['apixaban', 'ibuprofen'],
    severity: 'high',
    description: 'NSAIDs combined with direct oral anticoagulants like apixaban raise gastrointestinal bleeding risk considerably.',
    recommendation: 'Avoid NSAIDs while taking apixaban. Use acetaminophen for pain.',
  },

  // ── Antiepiletics ────────────────────────────────────────────────────────────
  {
    drugs: ['phenytoin', 'valproate'],
    severity: 'moderate',
    description: 'Valproate displaces phenytoin from plasma proteins and inhibits its metabolism, leading to unpredictable phenytoin levels — both toxicity and sub-therapeutic levels have been reported.',
    recommendation: 'Monitor total and free phenytoin levels closely when used together.',
  },

  // ── Diabetes ─────────────────────────────────────────────────────────────────
  {
    drugs: ['metformin', 'alcohol'],
    severity: 'moderate',
    description: 'Chronic or heavy alcohol use combined with metformin increases the risk of lactic acidosis, a rare but serious complication.',
    recommendation: 'Limit or avoid alcohol consumption while taking metformin.',
  },
];

// ─── Interaction Checker ──────────────────────────────────────────────────────

/**
 * Checks if a newly added medication interacts with any existing medications.
 *
 * @param newMedName     The name of the medication being added.
 * @param existingNames  Names of medications already in the user's list.
 * @returns An array of matching DrugInteraction objects (may be empty).
 */
export function checkDrugInteractions(
  newMedName: string,
  existingNames: string[]
): DrugInteraction[] {
  const newLower      = newMedName.trim().toLowerCase();
  const existingLower = existingNames.map(n => n.trim().toLowerCase());
  const found: DrugInteraction[] = [];

  for (const interaction of INTERACTION_DB) {
    const [termA, termB] = interaction.drugs;

    const newMatchesA = newLower.includes(termA);
    const newMatchesB = newLower.includes(termB);

    if (newMatchesA) {
      if (existingLower.some(e => e.includes(termB))) {
        found.push(interaction);
      }
    } else if (newMatchesB) {
      if (existingLower.some(e => e.includes(termA))) {
        found.push(interaction);
      }
    }
  }

  // Deduplicate (same interaction matched from both sides)
  return found.filter((item, idx, arr) =>
    arr.findIndex(x => x.drugs[0] === item.drugs[0] && x.drugs[1] === item.drugs[1]) === idx
  );
}

/** Returns a badge color for a given severity level */
export function severityColor(severity: Severity): string {
  switch (severity) {
    case 'high':     return '#ef4444';
    case 'moderate': return '#f59e0b';
    case 'low':      return '#3b82f6';
  }
}

/** Returns a label string for a given severity level */
export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'high':     return 'HIGH';
    case 'moderate': return 'MODERATE';
    case 'low':      return 'LOW';
  }
}
