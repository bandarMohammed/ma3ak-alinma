import { UserContext, RiskLevel, ScoreColor } from "./types";

/**
 * Calculates Debt-to-Income (DTI) ratio
 */
export function calculateDTI(
  monthlyIncome: number,
  existingPayments: number,
  newPayment: number
): number {
  if (monthlyIncome <= 0) return 1;
  return (existingPayments + newPayment) / monthlyIncome;
}

/**
 * Calculates how many months the emergency fund (savings) covers
 */
export function calculateEmergencyFundMonths(
  currentSavings: number,
  fixedExpenses: number,
  newPayment: number
): number {
  const totalCommitments = fixedExpenses + newPayment;
  if (totalCommitments <= 0) return 999;
  return currentSavings / totalCommitments;
}

/**
 * Calculates the percentage reduction in monthly savings surplus
 */
export function calculateSavingsReduction(
  newPayment: number,
  monthlyIncome: number,
  fixedExpenses: number,
  existingPayments: number
): number {
  const currentSurplus = monthlyIncome - fixedExpenses - existingPayments;
  if (currentSurplus <= 0) return 1; // 100% reduction
  return Math.min(1, newPayment / currentSurplus);
}

/**
 * Run sensitivity shock tests on the user's cash flow
 */
export function runSensitivityAnalysis(
  context: UserContext,
  newPayment: number
) {
  const currentSurplus = context.monthlyIncome - context.monthlyFixedExpenses - context.existingFinancingPayments;
  const newSurplus = currentSurplus - newPayment;

  // 1. Income drops 15%
  const shockedIncome = context.monthlyIncome * 0.85;
  const shockedIncomeSurplus = shockedIncome - context.monthlyFixedExpenses - context.existingFinancingPayments - newPayment;
  const incomeShockFailed = shockedIncomeSurplus < 0;

  // 2. Expenses increase 10%
  const shockedExpenses = context.monthlyFixedExpenses * 1.10;
  const shockedExpensesSurplus = context.monthlyIncome - shockedExpenses - context.existingFinancingPayments - newPayment;
  const expenseShockFailed = shockedExpensesSurplus < 0;

  // 3. Emergency cost of 5,000 SAR
  const shockedSavings = Math.max(0, context.currentSavings - 5000);
  const shockedEmergencyMonths = calculateEmergencyFundMonths(
    shockedSavings,
    context.monthlyFixedExpenses,
    newPayment
  );
  const emergencyShockFailed = shockedEmergencyMonths < 2.0;

  return {
    incomeShock: {
      value: "15%",
      failed: incomeShockFailed,
      surplus: shockedIncomeSurplus
    },
    expenseShock: {
      value: "10%",
      failed: expenseShockFailed,
      surplus: shockedExpensesSurplus
    },
    emergencyShock: {
      value: "5,000 SAR",
      failed: emergencyShockFailed,
      months: shockedEmergencyMonths
    }
  };
}

/**
 * Determines risk level based on DTI, emergency months, savings impact, and cashflow
 */
export function determineRiskLevel(
  dti: number,
  emergencyMonths: number,
  savingsImpact: number,
  newSurplus: number
): RiskLevel {
  if (dti > 0.50 || emergencyMonths < 1.5 || savingsImpact > 0.80 || newSurplus < 0) {
    return "High Risk";
  }
  if (dti > 0.35 || emergencyMonths < 3.0 || savingsImpact > 0.40) {
    return "Medium Risk";
  }
  return "Low Risk";
}

/**
 * Programmatically calculates a financial decision score from 0-100
 */
export function calculateDecisionScore(
  dti: number,
  emergencyMonths: number,
  savingsImpact: number,
  newSurplus: number,
  shocksFailedCount: number
): { score: number; color: ScoreColor; label: string } {
  let score = 100;

  // 1. DTI Deductions (max 30 pts)
  if (dti > 0.33) {
    const excessDti = dti - 0.33;
    score -= Math.min(30, excessDti * 120); // Scale deduction
  }

  // 2. Savings Impact / Cashflow Deductions (max 40 pts)
  if (newSurplus < 0) {
    score -= 40; // Deficit cashflow
  } else if (savingsImpact > 0.30) {
    const excessImpact = savingsImpact - 0.30;
    score -= Math.min(25, excessImpact * 50);
  }

  // 3. Emergency Buffer Deductions (max 20 pts)
  if (emergencyMonths < 4.0) {
    const gap = 4.0 - emergencyMonths;
    score -= Math.min(20, gap * 7);
  }

  // 4. Sensitivity failure deductions (max 10 pts)
  score -= shocksFailedCount * 3.3;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let color: ScoreColor = "red";
  let label = "Not Recommended";

  if (score >= 80) {
    color = "green";
    label = "Excellent Decision";
  } else if (score >= 60) {
    color = "blue";
    label = "Good Decision";
  } else if (score >= 40) {
    color = "yellow";
    label = "Needs Review";
  }

  return { score, color, label };
}
