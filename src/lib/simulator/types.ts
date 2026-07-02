export interface UserContext {
  monthlyIncome: number;
  monthlyFixedExpenses: number;
  currentSavings: number;
  existingFinancingPayments: number;
}

/**
 * Structured intent extracted from free-text (incl. Saudi colloquial Arabic) by the LLM,
 * then fed into the deterministic SimulatorManager so the math stays accurate.
 */
export interface ExtractedIntent {
  isSimulation: boolean;
  financingType: "cash" | "financing";
  category:
    | "car" | "phone" | "laptop" | "travel" | "wedding"
    | "renovation" | "tuition" | "medical" | "business" | "loan" | "generic";
  amount: number | null;        // total price or financing amount, in SAR
  tenureMonths: number | null;  // repayment / projection period in months
  downPayment: number | null;
  installment: number | null;
  finalPayment?: number | null;  // balloon / final lump payment (financing only)
}

/**
 * Which slot the advisor is currently waiting the customer to answer.
 */
export type SimulationSlot =
  | "financingType" | "amount" | "installment"
  | "downPayment" | "finalPayment" | "tenure";

/**
 * In-progress conversational simulation state. Round-trips through the assistant
 * message metadata (metadata.pendingSim) so the stateless API can resume slot-filling.
 */
export interface PendingSim {
  awaiting: SimulationSlot;
  collected: {
    financingType?: "cash" | "financing";
    category?: ExtractedIntent["category"];
    amount?: number;
    installment?: number;
    downPayment?: number;
    finalPayment?: number;
    tenureMonths?: number;
  };
}

export type RiskLevel = "Low Risk" | "Medium Risk" | "High Risk";
export type ScoreColor = "green" | "blue" | "yellow" | "red";

export interface DecisionScore {
  score: number; // 0-100
  color: ScoreColor;
  label: string; // "Excellent Decision", "Good Decision", "Needs Review", "Not Recommended"
  reasons: string[]; // "Why?" diagnostic points
}

export interface Scenario {
  name: string; // "Proceed Today" | "Increase Down Payment" | "Delay Purchase"
  monthly_impact: number;
  balance_in_period: number;
  verdict: string;
}

export interface SmartInsight {
  text: string;
}

export interface TimelinePoint {
  month: number;
  monthName: string;
  balanceNow: number;
  balanceWait: number;
  balanceAdjusted: number;
}

export interface MetricRow {
  metric: string;
  scenarioNow: string;
  scenarioWait: string;
  scenarioAdjusted: string;
}

export interface SensitivityMetric {
  metric: string;
  value: string;
  impactText: string;
  isCritical: boolean;
}

export interface SimulationResult {
  type: "simulation";
  decision: string;
  score: DecisionScore;
  riskLevel: RiskLevel;
  scenarios: Scenario[];
  insights: SmartInsight[];
  timeline: TimelinePoint[];
  tableData: MetricRow[];
  sensitivity: SensitivityMetric[];
  warnings: string[];
  summary: string;
  projectionMonths: number; // 6, 12, 36, 60
}
