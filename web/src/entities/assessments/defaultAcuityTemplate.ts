/**
 * Hardcoded fallback for the default acuity rubric (mirrors acuityRubrics/default in Firestore).
 * Used in AssessmentsTab when no custom acuity templates have been created for the org.
 */
export const DEFAULT_ACUITY_TEMPLATE = {
  id: "default",
  title: "Default Acuity Assessment",
  kind: "acuity",
  scope: "customer" as const,
  schema: {
    type: "rubric" as const,
    rubric: {
      title: "Default Acuity Assessment",
      version: "v1",
      questions: [
        {
          id: "housing",
          label: "Housing Situation",
          options: [
            { value: "No support needed to maintain permanent housing",              label: "No support needed to maintain permanent housing",              points: 0   },
            { value: "Housed; needs support to maintain permanent housing",          label: "Housed; needs support to maintain permanent housing",          points: 0.4 },
            { value: "Couch surfing; temporarily housed; at risk of homelessness",   label: "Couch surfing; temporarily housed; at risk of homelessness",   points: 0.6 },
            { value: "Warming Center or other emergency shelter",                    label: "Warming Center or other emergency shelter",                    points: 0.6 },
            { value: "Transitional Housing",                                         label: "Transitional Housing",                                         points: 0.6 },
            { value: "Unsheltered (place not meant for habitation)",                 label: "Unsheltered (place not meant for habitation)",                 points: 0.8 },
          ],
        },
        {
          id: "household",
          label: "Household Type",
          options: [
            { value: "Individual",                                                   label: "Individual",                                                   points: 0   },
            { value: "Youth",                                                        label: "Youth",                                                        points: 0.4 },
            { value: "Family or Youth HoH; Family with 4 or fewer members",         label: "Family or Youth HoH; Family with 4 or fewer members",         points: 0.6 },
            { value: "Family or Youth HoH; Family with 5 or more members",          label: "Family or Youth HoH; Family with 5 or more members",          points: 0.8 },
            { value: "Youth HoH; Family with 5 or more members",                    label: "Youth HoH; Family with 5 or more members",                    points: 1.0 },
          ],
        },
        {
          id: "lep",
          label: "Limited English Proficiency (LEP)?",
          options: [
            { value: "No",  label: "No",  points: 0   },
            { value: "LEP", label: "LEP", points: 0.6 },
          ],
        },
        {
          id: "crisis",
          label: "Likelihood of Need for Crisis Intervention from CM",
          options: [
            { value: "Rare crisis experiences; client has outside support other than CM",                                      label: "Rare crisis experiences; client has outside support other than CM",                                      points: 0   },
            { value: "Occasional crisis experiences; client has some support other than CM",                                    label: "Occasional crisis experiences; client has some support other than CM",                                    points: 0.8 },
            { value: "Frequent crisis experiences; needs support from CM and has some external provider support",               label: "Frequent crisis experiences; needs support from CM and has some external provider support",               points: 1.6 },
            { value: "Frequent severe crisis experiences; CM is primary support",                                               label: "Frequent severe crisis experiences; CM is primary support",                                               points: 2.0 },
          ],
        },
        {
          id: "independence",
          label: "Ability to manage tasks/needs independently",
          options: [
            { value: "Task/needs support from CM usually not required",              label: "Task/needs support from CM usually not required",              points: 0   },
            { value: "Task/needs support from CM often requested",                   label: "Task/needs support from CM often requested",                   points: 1.2 },
            { value: "Client struggles to independently accomplish many tasks/needs", label: "Client struggles to independently accomplish many tasks/needs", points: 1.6 },
            { value: "No ability to independently manage tasks/needs",               label: "No ability to independently manage tasks/needs",               points: 2.0 },
          ],
        },
      ],
      levels: [
        { min: 0,   max: 2,   label: "Minimal Acuity"  },
        { min: 3,   max: 3.5, label: "Moderate Acuity" },
        { min: 3.6, max: 4.5, label: "High Acuity"     },
        { min: 4.6, max: 10,  label: "Intense Acuity"  },
      ],
    },
  },
} as const;
